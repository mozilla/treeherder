import pytest

from tests.perf.auto_sheriffing_criteria.conftest import CASSETTES_RECORDING_DATE
from treeherder.perf.sheriffing_criteria import FixRatioFormula

pytestmark = [pytest.mark.freeze_time(CASSETTES_RECORDING_DATE, tick=True)]


# Fix ratio formula - specification
# ---------------------------------
# Bugs resolved as fixed vs resolved bugs
# Considers only
#  resolved bugs that are at least 2 weeks old
#  bugs that date back to last quantifying period


@pytest.mark.parametrize(
    "framework, suite",
    [
        # Sheriffed tests
        ("build_metrics", "build times"),  # 37.5%
        ("build_metrics", "installer size"),  # 41.6%
        ("raptor", "raptor-speedometer-firefox"),  # 100%
        ("raptor", "raptor-webaudio-firefox"),  # 100%
    ],
)
def test_formula_confirms_sheriffed_tests(framework, suite, betamax_recorder):
    fix_ratio = FixRatioFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette(f"{framework}-{suite}", serialize_with="prettyjson"):
        assert fix_ratio(framework, suite) >= 0.3


@pytest.mark.parametrize(
    "framework, suite, test",
    [
        # Non-sheriffed tests
        ("awsy", "JS", None),  # 20%
        ("talos", "tp5n", "nonmain_startup_fileio"),  # 0%
    ],
)
def test_formula_confirms_non_sheriffed_tests(framework, suite, test, betamax_recorder):
    fix_ratio = FixRatioFormula(betamax_recorder.session)

    with betamax_recorder.use_cassette(f"{framework}-{suite}", serialize_with="prettyjson"):
        assert fix_ratio(framework, suite, test) < 0.3
