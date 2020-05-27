import pytest
from datetime import datetime, timedelta
from requests import Session

from betamax import Betamax
from betamax_serializers import pretty_json
from typing import List

from treeherder.config.settings import BZ_DATETIME_FORMAT
from treeherder.perf.sheriffing_criteria import EngineerTractionFormula
from treeherder.perf.exceptions import NoFiledBugs
from treeherder.utils.http import create_bugzilla_session

CASSETTE_LIBRARY_DIR = 'tests/sample_data/betamax_cassettes/perf_sheriffing_criteria'
VCR_RECORDING_DATE = 'June 2nd, 2020'


pytestmark = [pytest.mark.freeze_time(VCR_RECORDING_DATE, tick=True)]


# Engineer traction formula - specification
# -----------------------------------------
# All bugs except NEW -- vs total filed bugs
# Considers only
#  bugs filed by perf sheriffs
#  bugs that date back to last quantifying period
#  bugs’ state by the end of the 2nd week
#  bugs that are at least 2 weeks old


@pytest.fixture
def session() -> Session:
    return create_bugzilla_session()


@pytest.fixture
def betamax_recorder(session):
    Betamax.register_serializer(pretty_json.PrettyJSONSerializer)
    return Betamax(session, cassette_library_dir=CASSETTE_LIBRARY_DIR)


@pytest.fixture
def quantified_bugs(betamax_recorder) -> list:
    params = {
        'longdesc': 'raptor speedometer',
        'longdesc_type': 'allwords',
        'longdesc_initial': 1,
        'keywords': 'perf,perf-alert',
        'keywords_type': 'anywords',
        'creation_time': '2019-12-17',
        'query_format': 'advanced',
    }

    with betamax_recorder.use_cassette('quantified-bugs', serialize_with='prettyjson'):
        bug_resp = betamax_recorder.session.get(
            'https://bugzilla.mozilla.org/rest/bug',
            headers={'Accept': 'application/json'},
            params=params,
            timeout=60,
        )
        return bug_resp.json()['bugs']


@pytest.fixture
def cooled_down_bugs(session, quantified_bugs) -> List[dict]:
    bugs = []
    for bug in quantified_bugs:
        created_at = datetime.strptime(bug['creation_time'], BZ_DATETIME_FORMAT)
        if created_at <= datetime.now() - timedelta(weeks=2):
            bugs.append(bug)
    return bugs


def test_formula_demands_at_least_framework_and_suite(betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    with pytest.raises(TypeError):
        engineer_traction('some_framework')

    with pytest.raises(TypeError):
        engineer_traction()

    with betamax_recorder.use_cassette('awsy-JS', serialize_with='prettyjson'):
        try:
            engineer_traction('awsy', 'JS')
        except TypeError:
            pytest.fail()


def test_formula_exposes_oldest_timestamp(session):
    engineer_traction = EngineerTractionFormula(session)
    no_older_than = datetime.now() - timedelta(weeks=24, seconds=5)

    assert engineer_traction.oldest_timestamp >= no_older_than


@pytest.mark.parametrize(
    'cooled_down_bug',
    [
        {"creation_time": "2020-05-18T15:20:55Z"},  # older than 2 weeks
        {"creation_time": "2020-05-04T15:20:55Z"},  # older than 1 month
        {"creation_time": "2019-12-16T08:10:37Z"},  # older than 6 months
    ],
)
def test_formula_correctly_detects_cooled_down_bugs(cooled_down_bug, session):
    engineer_traction = EngineerTractionFormula(session)

    assert engineer_traction.has_cooled_down(cooled_down_bug)


@pytest.mark.parametrize(
    'not_cooled_down_bug',
    [
        {'creation_time': '2020-05-31T00:00:00Z'},  # 2 days old
        {'creation_time': '2020-05-26T00:00:00Z'},  # 1 week old
        {'creation_time': '2020-05-19T23:00:00Z'},  # ~2 weeks old, except for 1 hour
    ],
)
def test_formula_detects_bugs_that_didnt_cool_down_yet(not_cooled_down_bug, session):
    engineer_traction = EngineerTractionFormula(session)

    assert not engineer_traction.has_cooled_down(not_cooled_down_bug)


@pytest.mark.parametrize('bad_structured_bug', [{}, {'creation_time': 'jiberish-date'}])
def test_formula_throws_adequate_error_for_bug(bad_structured_bug, session):
    engineer_traction = EngineerTractionFormula(session)

    with pytest.raises(ValueError):
        engineer_traction.has_cooled_down(bad_structured_bug)


def test_accessing_breakdown_without_prior_calculus_errors_out(session):
    engineer_traction = EngineerTractionFormula(session)

    with pytest.raises(RuntimeError):
        _ = engineer_traction.breakdown()


# Leveraging HTTP VCR


def test_breakdown_updates_between_calculations(betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    test_moniker_A = ('build_metrics', 'build times')
    test_moniker_B = ('talos', 'tp5n', 'nonmain_startup_fileio')

    cassette_preffix_A = '-'.join(filter(None, test_moniker_A))
    cassette_preffix_B = '-'.join(filter(None, test_moniker_B))

    with betamax_recorder.use_cassette(f'{cassette_preffix_A}', serialize_with='prettyjson'):
        engineer_traction(*test_moniker_A)  # let it perform calculus & cache breakdown
        breakdown_A = engineer_traction.breakdown()

    with betamax_recorder.use_cassette(f'{cassette_preffix_B}', serialize_with='prettyjson'):
        engineer_traction(*test_moniker_B)  # let it perform calculus & cache breakdown
        breakdown_B = engineer_traction.breakdown()

    assert breakdown_A != breakdown_B


def test_breakdown_resets_to_null_when_calculus_errors_out(betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    test_moniker_A = ('build_metrics', 'build times')
    test_moniker_B = ('nonexistent_framework', 'nonexistent_suite')

    cassette_preffix_A = '-'.join(filter(None, test_moniker_A))
    cassette_preffix_B = '-'.join(filter(None, test_moniker_B))

    # run happy path calculus
    with betamax_recorder.use_cassette(f'{cassette_preffix_A}', serialize_with='prettyjson'):
        engineer_traction(*test_moniker_A)  # let it perform calculus & cache breakdown
        _ = engineer_traction.breakdown()

    # now run alternated path calculus
    with betamax_recorder.use_cassette(f'{cassette_preffix_B}', serialize_with='prettyjson'):
        with pytest.raises(NoFiledBugs):
            engineer_traction(*test_moniker_B)  # intentionally blows up while doing calculus

        # cached breakdown got invalidated & can no longer be obtained
        with pytest.raises(RuntimeError):
            _ = engineer_traction.breakdown()


@pytest.mark.parametrize(
    'framework, suite, test',
    [
        ('build_metrics', 'build times', None),
        ('build_metrics', 'installer size', None),
        ('awsy', 'JS', None),
        ('talos', 'tp5n', 'nonmain_startup_fileio'),
    ],
)
def test_formula_fetches_bugs_from_quantifying_period(framework, suite, test, betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)
    cassette = '-'.join(filter(None, [framework, suite, test]))

    with betamax_recorder.use_cassette(f'{cassette}', serialize_with='prettyjson'):
        engineer_traction(framework, suite, test)  # let it perform calculus & cache breakdown

    all_filed_bugs, except_new_bugs = engineer_traction.breakdown()

    assert len(all_filed_bugs) > 0
    for bug in all_filed_bugs:
        creation_time = datetime.strptime(bug['creation_time'], BZ_DATETIME_FORMAT)
        assert creation_time >= engineer_traction.oldest_timestamp


@pytest.mark.parametrize(
    'framework, suite, test',
    [
        ('build_metrics', 'build times', None),
        ('build_metrics', 'installer size', None),
        ('awsy', 'JS', None),
        ('talos', 'tp5n', 'nonmain_startup_fileio'),
    ],
)
def test_formula_filters_out_bugs_that_didnt_cool_down_yet(
    framework, suite, test, betamax_recorder
):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)
    cassette = '-'.join(filter(None, [framework, suite, test]))

    with betamax_recorder.use_cassette(f'{cassette}', serialize_with='prettyjson'):
        engineer_traction(framework, suite, test)  # let it perform calculus & cache breakdown

    # left with cooled down bugs only
    all_filed_bugs, _ = engineer_traction.breakdown()
    for bug in all_filed_bugs:
        assert engineer_traction.has_cooled_down(bug)


def test_formula_counts_tracted_bugs(cooled_down_bugs, betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette('cooled-down-bug-history', serialize_with='prettyjson'):
        tracted_bugs = engineer_traction._filter_tracted_bugs(cooled_down_bugs)
        assert len(tracted_bugs) == 2


@pytest.mark.parametrize(
    'framework, suite',
    [
        # Sheriffed tests
        ('build_metrics', 'build times'),  # 92%
        ('build_metrics', 'installer size'),  # 78%
        ('awsy', 'JS'),  # 55%
    ],
)
def test_final_formula_confirms_sheriffed_tests(framework, suite, betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette(f'{framework}-{suite}', serialize_with='prettyjson'):
        assert engineer_traction(framework, suite) >= 0.35


@pytest.mark.parametrize(
    'framework, suite',
    [
        # Non-sheriffed tests
        ('raptor', 'raptor-speedometer-firefox'),  # 33%
        ('raptor', 'raptor-webaudio-firefox'),  # 0%
    ],
)
def test_final_formula_confirms_non_sheriffed_tests(framework, suite, betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette(f'{framework}-{suite}', serialize_with='prettyjson'):
        assert engineer_traction(framework, suite) < 0.35


def test_formula_errors_up_when_no_bugs_were_filed(betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)
    nonexistent_framework = 'nonexistent_framework'
    nonexistent_suite = 'nonexistent_suite'

    with betamax_recorder.use_cassette(
        f'{nonexistent_framework}-{nonexistent_suite}', serialize_with='prettyjson'
    ):
        with pytest.raises(NoFiledBugs):
            engineer_traction(nonexistent_framework, nonexistent_suite)
