from datetime import datetime, timedelta

import pytest

from tests.perf.auto_sheriffing_criteria.conftest import CASSETTES_RECORDING_DATE
from treeherder.config.settings import BZ_DATETIME_FORMAT
from treeherder.perf.sheriffing_criteria import EngineerTractionFormula

pytestmark = [pytest.mark.freeze_time(CASSETTES_RECORDING_DATE, tick=True)]


# Engineer traction formula - specification
# -----------------------------------------
# All bugs except NEW -- vs total filed bugs
# Considers only
#  bugs filed by perf sheriffs
#  bugs that date back to last quantifying period
#  bugs’ state by the end of the 2nd week
#  bugs that are at least 2 weeks old


@pytest.fixture
def quantified_bugs(betamax_recorder) -> list:
    params = {
        "longdesc": "raptor speedometer",
        "longdesc_type": "allwords",
        "longdesc_initial": 1,
        "keywords": "perf,perf-alert",
        "keywords_type": "anywords",
        "creation_time": "2019-12-17",
        "query_format": "advanced",
    }

    with betamax_recorder.use_cassette("quantified-bugs", serialize_with="prettyjson"):
        bug_resp = betamax_recorder.session.get(
            "https://bugzilla.mozilla.org/rest/bug",
            headers={"Accept": "application/json"},
            params=params,
            timeout=60,
        )
        return bug_resp.json()["bugs"]


@pytest.fixture
def cooled_down_bugs(nonblock_session, quantified_bugs) -> list[dict]:
    bugs = []
    for bug in quantified_bugs:
        created_at = datetime.strptime(bug["creation_time"], BZ_DATETIME_FORMAT)
        if created_at <= datetime.now() - timedelta(weeks=2):
            bugs.append(bug)
    return bugs


# Leveraging HTTP VCR


def test_formula_counts_tracted_bugs(cooled_down_bugs, betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette("cooled-down-bug-history", serialize_with="prettyjson"):
        tracted_bugs = engineer_traction._filter_numerator_bugs(cooled_down_bugs)
        assert len(tracted_bugs) == 2


@pytest.mark.parametrize(
    "framework, suite, test",
    [
        # Sheriffed tests
        ("build_metrics", "build times", None),  # 92%
        ("build_metrics", "installer size", None),  # 78%
        ("awsy", "JS", None),  # 55%
        ("talos", "tp5n", "main_startup_fileio"),  # 50%
    ],
)
def test_final_formula_confirms_sheriffed_tests(framework, suite, test, betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette(f"{framework}-{suite}", serialize_with="prettyjson"):
        assert engineer_traction(framework, suite) >= 0.35


@pytest.mark.parametrize(
    "framework, suite, test",
    [
        # Non-sheriffed tests
        ("raptor", "raptor-speedometer-firefox", None),  # 33%
        ("raptor", "raptor-webaudio-firefox", None),  # 0%
        ("raptor", "raptor-tp6-google-mail-firefox-cold", "replayed"),  # 0%
    ],
)
def test_final_formula_confirms_non_sheriffed_tests(framework, suite, test, betamax_recorder):
    engineer_traction = EngineerTractionFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette(f"{framework}-{suite}", serialize_with="prettyjson"):
        assert engineer_traction(framework, suite, test) < 0.35
