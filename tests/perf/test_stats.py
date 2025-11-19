# from treeherder.model.models import Push
from treeherder.perf.stats import (
    interpret_cles,
    interpret_silverman_kde,
    plot_kde_with_isj_bandwidth,
)

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


def test_plot_kde_with_isj_bandwidth():
    mock_base = [2.74]
    mock_new = [2.65]

    (kde_plot_base, kde_plot_new, kde_warnings) = plot_kde_with_isj_bandwidth(
        mock_base,
        mock_new,
    )

    assert (
        kde_warnings[0]
        == "Less than 2 datapoints or no standard variance for a meaningful fit Kernel Density Estimator (KDE) with an ISJ bandwidth to Base."
    )
    assert (
        kde_warnings[1]
        == "Less than 2 datapoints or no standard variance for a meaningful fit Kernel Density Estimator (KDE) with an ISJ bandwidth to New."
    )

    mock_base_2 = [2.74, 2.56, 2.88]
    mock_new_2 = [2.65, 2.33, 2.25]
    (kde_plot_base, kde_plot_new, kde_warnings) = plot_kde_with_isj_bandwidth(
        mock_base_2,
        mock_new_2,
    )
    assert kde_plot_new["sample_count"] == 3
    assert kde_plot_base["sample_count"] == 3


def test_interpret_cles():
    mock_base = [2.74]
    mock_new = [2.65]
    mock_mann_stat = 0.1
    interpretation = ("",)
    lower_is_better = (False,)
    mock_delta = 0.2

    (cles_obj, cles, cles_explanation, mann_whitney_u_cles, cliffs_delta_cles, is_base_greater) = (
        interpret_cles(
            mock_mann_stat,
            mock_new,
            mock_base,
            mock_delta,
            interpretation,
            lower_is_better,
        )
    )

    assert cles_obj["cles"] == 0.1
    assert cles == 0.1
    assert is_base_greater is None
