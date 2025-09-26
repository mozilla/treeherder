# from treeherder.model.models import Push
from treeherder.perf.stats import interpret_silverman_kde

# p-value threshold to use throughout
PVALUE_THRESHOLD = 0.05

# def test_split_per_mode():


def test_interpret_silverman_kde():
    mock_base = [2.74]
    mock_new = [2.65]
    lower_is_better = False
    (
        silverman_kde,
        is_regression,
        is_improvement,
        more_runs_are_needed,
        warning_msgs,
        performance_intepretation,
    ) = interpret_silverman_kde(mock_base, mock_new, lower_is_better)
    assert silverman_kde["bandwidth"] == "Silverman"
    assert warning_msgs == []
