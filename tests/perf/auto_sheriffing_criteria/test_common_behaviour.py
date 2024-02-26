from datetime import datetime, timedelta

import pytest
from django.conf import settings
from typing import Callable

from tests.perf.auto_sheriffing_criteria.conftest import CASSETTES_RECORDING_DATE
from treeherder.config.settings import BZ_DATETIME_FORMAT
from treeherder.perf.exceptions import NoFiledBugs
from treeherder.perf.sheriffing_criteria import (
    EngineerTractionFormula,
    FixRatioFormula,
    BugzillaFormula,
    TotalAlertsFormula,
)


pytestmark = [pytest.mark.freeze_time(CASSETTES_RECORDING_DATE, tick=True)]


def bugzilla_formula_instances() -> list[BugzillaFormula]:
    return [EngineerTractionFormula(), FixRatioFormula()]


def formula_instances() -> list[Callable]:
    return bugzilla_formula_instances() + [TotalAlertsFormula()]


def concrete_formula_classes() -> list[type[BugzillaFormula]]:
    return [EngineerTractionFormula, FixRatioFormula]


@pytest.mark.parametrize("formula", formula_instances())
def test_formula_exposes_quantifying_period(formula, nonblock_session):
    assert formula.quantifying_period == settings.QUANTIFYING_PERIOD


@pytest.mark.parametrize("formula", bugzilla_formula_instances())
def test_formula_exposes_oldest_timestamp(formula, nonblock_session):
    no_older_than = datetime.now() - timedelta(weeks=24, seconds=5)

    assert formula.oldest_timestamp >= no_older_than


def test_total_alerts_formula_exposes_oldest_timestamp():
    no_older_than = datetime.now() - (timedelta(weeks=24, seconds=5) + timedelta(weeks=2))

    assert TotalAlertsFormula().oldest_timestamp >= no_older_than


@pytest.mark.parametrize("formula", bugzilla_formula_instances())
@pytest.mark.parametrize(
    "cooled_down_bug",
    [
        {"creation_time": "2020-05-18T15:20:55Z"},  # older than 2 weeks
        {"creation_time": "2020-05-04T15:20:55Z"},  # older than 1 month
        {"creation_time": "2019-12-16T08:10:37Z"},  # older than 6 months
    ],
)
def test_formula_correctly_detects_cooled_down_bugs(cooled_down_bug, formula, nonblock_session):
    assert formula.has_cooled_down(cooled_down_bug)


@pytest.mark.parametrize("formula", bugzilla_formula_instances())
@pytest.mark.parametrize(
    "not_cooled_down_bug",
    [
        {"creation_time": "2020-05-31T00:00:00Z"},  # 2 days old
        {"creation_time": "2020-05-26T00:00:00Z"},  # 1 week old
        {"creation_time": "2020-05-19T23:00:00Z"},  # ~2 weeks old, except for 1 hour
    ],
)
def test_formula_detects_bugs_that_didnt_cool_down_yet(
    not_cooled_down_bug, formula, nonblock_session
):
    assert not formula.has_cooled_down(not_cooled_down_bug)


@pytest.mark.parametrize("formula", bugzilla_formula_instances())
@pytest.mark.parametrize("bad_structured_bug", [{}, {"creation_time": "jiberish-date"}])
def test_formula_throws_adequate_error_for_bug(bad_structured_bug, formula, nonblock_session):
    with pytest.raises(ValueError):
        formula.has_cooled_down(bad_structured_bug)


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
def test_formula_initializes_with_non_blockable_sessions(formula_class, nonblock_session):
    try:
        _ = formula_class(nonblock_session)
    except TypeError:
        pytest.fail()

    try:
        _ = formula_class()
    except TypeError:
        pytest.fail()


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
def test_formula_cannot_be_initialized_with_a_regular_session(formula_class, unrecommended_session):
    with pytest.raises(TypeError):
        _ = formula_class(unrecommended_session)


@pytest.mark.parametrize("formula", bugzilla_formula_instances())
def test_accessing_breakdown_without_prior_calculus_errors_out(formula, nonblock_session):
    with pytest.raises(RuntimeError):
        _ = formula.breakdown()


# Leveraging HTTP VCR


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
def test_formula_demands_at_least_framework_and_suite(formula_class, betamax_recorder):
    formula = formula_class(betamax_recorder.session)

    with pytest.raises(TypeError):
        formula("some_framework")

    with pytest.raises(TypeError):
        formula()

    with betamax_recorder.use_cassette("awsy-JS", serialize_with="prettyjson"):
        try:
            formula("awsy", "JS")
        except TypeError:
            pytest.fail()


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
def test_breakdown_updates_between_calculations(formula_class, betamax_recorder):
    formula = formula_class(betamax_recorder.session)

    test_moniker_a = ("build_metrics", "build times")
    test_moniker_b = ("talos", "tp5n", "nonmain_startup_fileio")

    cassette_preffix_a = "-".join(filter(None, test_moniker_a))
    cassette_preffix_b = "-".join(filter(None, test_moniker_b))

    with betamax_recorder.use_cassette(f"{cassette_preffix_a}", serialize_with="prettyjson"):
        formula(*test_moniker_a)  # let it perform calculus & cache breakdown
        breakdown_a = formula.breakdown()

    with betamax_recorder.use_cassette(f"{cassette_preffix_b}", serialize_with="prettyjson"):
        formula(*test_moniker_b)  # let it perform calculus & cache breakdown
        breakdown_b = formula.breakdown()

    assert breakdown_a != breakdown_b


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
def test_breakdown_resets_to_null_when_calculus_errors_out(formula_class, betamax_recorder):
    formula = formula_class(betamax_recorder.session)

    test_moniker_a = ("build_metrics", "build times")
    test_moniker_b = ("nonexistent_framework", "nonexistent_suite")

    cassette_preffix_a = "-".join(filter(None, test_moniker_a))
    cassette_preffix_b = "-".join(filter(None, test_moniker_b))

    # run happy path calculus
    with betamax_recorder.use_cassette(f"{cassette_preffix_a}", serialize_with="prettyjson"):
        formula(*test_moniker_a)  # let it perform calculus & cache breakdown
        _ = formula.breakdown()

    # now run alternated path calculus
    with betamax_recorder.use_cassette(f"{cassette_preffix_b}", serialize_with="prettyjson"):
        with pytest.raises(NoFiledBugs):
            formula(*test_moniker_b)  # intentionally blows up while doing calculus

        # cached breakdown got invalidated & can no longer be obtained
        with pytest.raises(RuntimeError):
            _ = formula.breakdown()


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
@pytest.mark.parametrize(
    "framework, suite, test",
    [
        ("build_metrics", "build times", None),
        ("build_metrics", "installer size", None),
        ("awsy", "JS", None),
        ("talos", "tp5n", "nonmain_startup_fileio"),
    ],
)
def test_formula_fetches_bugs_from_quantifying_period(
    framework, suite, test, formula_class, betamax_recorder
):
    formula = formula_class(betamax_recorder.session)
    cassette = "-".join(filter(None, [framework, suite, test]))

    with betamax_recorder.use_cassette(f"{cassette}", serialize_with="prettyjson"):
        formula(framework, suite, test)  # let it perform calculus & cache breakdown

    all_filed_bugs, except_new_bugs = formula.breakdown()

    assert len(all_filed_bugs) > 0
    for bug in all_filed_bugs:
        creation_time = datetime.strptime(bug["creation_time"], BZ_DATETIME_FORMAT)
        assert creation_time >= formula.oldest_timestamp


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
@pytest.mark.parametrize(
    "framework, suite, test",
    [
        ("build_metrics", "build times", None),
        ("build_metrics", "installer size", None),
        ("awsy", "JS", None),
        ("talos", "tp5n", "nonmain_startup_fileio"),
    ],
)
def test_formula_filters_out_bugs_that_didnt_cool_down_yet(
    framework, suite, test, formula_class, betamax_recorder
):
    formula = formula_class(betamax_recorder.session)
    cassette = "-".join(filter(None, [framework, suite, test]))

    with betamax_recorder.use_cassette(f"{cassette}", serialize_with="prettyjson"):
        formula(framework, suite, test)  # let it perform calculus & cache breakdown

    # left with cooled down bugs only
    all_filed_bugs, _ = formula.breakdown()
    for bug in all_filed_bugs:
        assert formula.has_cooled_down(bug)


@pytest.mark.parametrize("formula_class", concrete_formula_classes())
def test_formula_errors_up_when_no_bugs_were_filed(formula_class, betamax_recorder):
    formula = formula_class(betamax_recorder.session)
    nonexistent_framework = "nonexistent_framework"
    nonexistent_suite = "nonexistent_suite"

    with betamax_recorder.use_cassette(
        f"{nonexistent_framework}-{nonexistent_suite}", serialize_with="prettyjson"
    ):
        with pytest.raises(NoFiledBugs):
            formula(nonexistent_framework, nonexistent_suite)
