import numpy as np
import pymannkendall as mk
from KDEpy import FFTKDE
from scipy import stats
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from scipy.stats import bootstrap, iqr, ks_2samp, mannwhitneyu, norm, spearmanr

# New Stats Code

# p-value threshold to use throughout
PVALUE_THRESHOLD = 0.05
# whether or not remove outliers using https://en.wikipedia.org/wiki/Interquartile_range
ENABLE_REMOVE_OUTLIERS = False


# returns sample count, mean, median. variance, standard deviation, min, max
def summarize_data(series):
    sample_count = len(series)
    mean = np.mean(series)
    median = np.median(series)
    variance = np.var(series, ddof=1)
    standard_deviation = np.std(series, ddof=1)
    min = np.min(series)
    max = np.max(series)
    summary = {
        "sample_count": sample_count,
        "mean": mean,
        "median": median,
        "variance": variance,
        "standard_deviation": standard_deviation,
        "min": min,
        "max": max,
    }
    return summary, sample_count, mean, median, variance, standard_deviation, min, max


# get basic statistics mean, median, variance, standard deviation, average, min, max
def summarize_basic_stats_data(base, new, header):
    title = "Basic statistics, normality test"
    info_link = "https://en.m.wikipedia.org/wiki/Shapiro%E2%80%93Wilk_test#"

    # Base Revision
    base_rev_info = {
        "name": "without patch",
        "data": base,
        "header": header,
        "title": title,
        "info_link": info_link,
        "sample_count": len(base),
        "mean": np.mean(base),
        "median": np.median(base),
        "variance": np.var(base, ddof=1),
        "standard_deviation": np.std(base, ddof=1),
        "average": np.average(base),
        "min": np.min(base),
        "max": np.max(base),
    }

    # New Revision
    new_rev_info = {
        "name": "with patch",
        "data": new,
        "header": header,
        "title": title,
        "info_link": info_link,
        "sample_count": len(new),
        "mean": np.mean(new),
        "median": np.median(new),
        "average": np.average(new),
        "variance": np.var(new, ddof=1),
        "standard_deviation": np.std(new, ddof=1),
        "min": np.min(new),
        "max": np.max(new),
    }

    return base_rev_info, new_rev_info


## IID detection


def mann_kendall_test(x):
    # https://pypi.org/project/pymannkendall/ explains all the variants, @padenot picked one he thought suitable
    trend, h, p, z, tau, s, var_s, slope, intercept = mk.hamed_rao_modification_test(x)
    return z, p


def compare_early_late(x, split_ratio=0.5):
    """
    Splits the data in two, by default in the middle, and run a Mann–Whitney U
    test. The null hypothesis is that the two populations are of the
    same distribution.

    Returns the (test_statistic, p_value).
    """
    x = np.array(x)
    n = len(x)
    split_index = int(n * split_ratio)
    early = x[:split_index]
    late = x[split_index:]
    stat, p = mannwhitneyu(early, late)
    return stat, p


def moving_median(x, window_size=5):
    """
    Compute the moving median with a window of 'window_size'.
    Returns an array of the same length, but the first (window_size-1)//2
    and last positions will be based on partial windows.
    """
    x = np.array(x)
    n = len(x)
    half_w = window_size // 2

    medians = []
    for i in range(n):
        left = max(0, i - half_w)
        right = min(n, i + half_w + 1)
        window = x[left:right]
        medians.append(np.median(window))
    return np.array(medians)


def wald_wolfowitz_runs_test(x):
    """
    Performs a Wald–Wolfowitz runs test for randomness around the median.

    https://en.wikipedia.org/wiki/Wald%E2%80%93Wolfowitz_runs_test
    (see the Applications section in particular)

    Returns (z_value, p_value).
    """
    x = np.array(x)
    median = np.median(x)

    # Convert to +1 (above median) / -1 (below median)
    signs = np.where(x >= median, 1, -1)

    # Count runs
    runs = 1
    for i in range(1, len(signs)):
        if signs[i] != signs[i - 1]:
            runs += 1

    n_pos = np.sum(signs == 1)
    n_neg = np.sum(signs == -1)
    n = n_pos + n_neg

    # Expected number of runs (since we're using the median)
    expected_runs = 1 + (2.0 * n_pos * n_neg) / n

    # Variance of runs
    numerator = 2.0 * n_pos * n_neg * (2.0 * n_pos * n_neg - n_pos - n_neg)
    denominator = float(n**2 * (n - 1))
    variance_runs = numerator / denominator if denominator != 0 else 0.0

    if variance_runs == 0.0:
        # Degenerate case
        z_value = 0.0
        p_value = 1.0
    else:
        z_value = (runs - expected_runs) / np.sqrt(variance_runs)
        p_value = 2.0 * (1.0 - norm.cdf(abs(z_value)))

    return z_value, p_value


def autocorrelation_spearman(x, max_lag=20, alpha=0.05):
    """
    Spearman autocorrelation up to 20 samples
    """
    x = np.array(x)
    corrs = []
    pvals = []
    lags = range(1, max_lag + 1)
    for lag in lags:
        if len(x) > lag:
            r, pval = spearmanr(x[:-lag], x[lag:])
            corrs.append(r)
            pvals.append(pval)
        else:
            corrs.append(np.nan)
            pvals.append(np.nan)

    for lag, r, pval in zip(lags, corrs, pvals):
        if not np.isnan(pval):
            if pval < alpha:
                print(
                    f"  Lag={lag}: correlation r={r:.3f}, p={pval:.3g} < {alpha} -> suggests dependence."
                )
                return False
    return True


def plot_cumulative_stats(x, iid_data):
    """
    Plots the cumulative mean and cumulative median of the data.
    """
    x = np.array(x)
    n = len(x)

    cum_mean = np.cumsum(x) / np.arange(1, n + 1)

    cum_median = []
    running_data = []
    for i in range(n):
        running_data.append(x[i])
        cum_median.append(np.median(running_data))
    cum_median = np.array(cum_median)

    window_size = int(len(x) / 10)
    mm = moving_median(x, window_size=window_size)

    moving_median_plot = {
        "mm": mm,
        "title": "Moving median",
        "xlabel": "Index",
        "ylabel": f"Moving median (window: {window_size})",
    }
    commulative_mean_plot = {
        "cum_mean": cum_mean,
        "title": "Cumulative Mean",
        "xlabel": "Index",
        "ylabel": "Cumulative Mean",
    }
    commulative_median_plot = {
        "cum_median": cum_median,
        "title": "Cumulative Median",
        "xlabel": "Index",
        "ylabel": "Cumulative Median",
    }
    iid_data["moving_median"] = moving_median_plot
    iid_data["cumulative_mean"] = commulative_mean_plot
    iid_data["cumulative_median"] = commulative_median_plot
    return iid_data


def interpret_mann_kendall(z, p, alpha=0.05):
    warning = None
    if p < alpha:
        direction = "upward" if z > 0 else "downward"
        warning = f"  Mann-Kendall p={p:.3g} < {alpha}, indicates a {direction} trend -> suspect not identically distributed."
        return True, warning
    else:
        return False, warning


def interpret_wilcoxon(stat, p, alpha=0.05):
    warning = None
    if p < alpha:
        warning = f"  Wilcoxon rank-sum p={p:.3g} < {alpha}, early vs. late differ -> suspect not identically distributed."
        return True, warning
    else:
        return False, warning


def interpret_runs_test(z, p, alpha=0.05):
    warning = None
    if p < alpha:
        warning = (
            f"  Runs test p={p:.3g} < {alpha}, data not random around median -> suspect dependence."
        )
        return True, warning
    else:
        return False, warning


def assess_iid(data, label, alpha=0.05):
    """
    Tests various methods to find non-iid data. If one of the test fails, warn and
    plot cumulative statistics.
    """
    is_iid = True  # assume iid, try to show that doesn't hold
    # Scattershot approach to non-iid identification, run a bunch of test,
    # warn if any of them fail

    iid_data = {
        "is_iid": True,
        "summary": "Assumed data is independent and identically distributed.",
    }
    z_mk, p_mk = mann_kendall_test(data)
    if interpret_mann_kendall(z_mk, p_mk, alpha):
        print("Mann kendall -- suspected non iid")
        summary = "Mann kendall -- suspected non iid"
        is_iid = False
        iid_data["is_iid"] = False
        iid_data["summary"] = summary

    z_wilcox, p_wilcox = compare_early_late(data, split_ratio=0.5)
    if interpret_wilcoxon(z_wilcox, p_wilcox, alpha):
        print("Wilcoxon -- suspected non iid")
        summary = "Wilcoxon -- suspected non iid"
        is_iid = False
        iid_data["is_iid"] = False
        iid_data["summary"] = summary
    z_runs, p_runs = wald_wolfowitz_runs_test(data)
    if interpret_runs_test(z_runs, p_runs, alpha):
        print("Wald-Wolfowitz -- suspected non iid")
        summary = "Wald-Wolfowitz -- suspected non iid"
        is_iid = False
        iid_data["is_iid"] = False
        iid_data["summary"] = summary
    # warns on perfect iid, so disabled for now
    # is_iid &= autocorrelation_spearman(data, max_lag=20, alpha=alpha)

    if not is_iid:
        print(f"Suspicion of non i.i.d. data for {label}, plotting cumulative statistics.")
        plot_cumulative_stats(data, iid_data)
    else:
        return iid_data


# Maybe not something we want, provided just in case, this is togglable,
# defaults to false
def remove_outliers(data):
    """Remove outliers using IQR method"""
    q1, q3 = np.percentile(data, [25, 75])
    iqr_value = iqr(data)
    lower_bound, upper_bound = q1 - 1.5 * iqr_value, q3 + 1.5 * iqr_value
    return [x for x in data if lower_bound <= x <= upper_bound]


# Returns the number and location of modes, from the KDE of a distribution,
# as well as the estimate used to determine if a peak is a mode or not.
def count_modes(x, y, min_prom_frac=0.02, max_prom_frac=0.2):
    """
    x, y: points for the KDE of a distribution
    min_prom_frac: relative minimum of the prominence as a fraction of the maximum of y (smoothed)
    max_prom_frac: relative maximum of the prominence as a fraction of the maximum of y (smoothed)
    """
    # Smooth outliers out
    y_smooth = gaussian_filter1d(y, sigma=2)

    # Compute derivative, keep high percentile, to find "real" peaks
    dy = np.gradient(y_smooth, x)
    noise_est = np.percentile(np.abs(dy), 90)

    # Set prominence proportional to that noise, capped to fraction of max
    max_y = np.max(y_smooth)
    prom_est = np.clip(noise_est, min_prom_frac * max_y, max_prom_frac * max_y)

    # grid has been fitted by KDEpy already. Consider that peaks should be at
    # least 5% of the data range appart. This helps keeping out "horns" at the
    # top of a mode.
    dx = x[1] - x[0]
    x_range = x[-1] - x[0]
    min_distance = max(1, int((x_range * 0.05) / dx))

    peaks, _ = find_peaks(y_smooth, prominence=prom_est, distance=min_distance)
    return len(peaks), x[peaks], prom_est


# Return a list of interval correspondings to the modes in the data series,
# from a KDE of the data and the location of the peaks. To do this, we find
# the valleys (minimums) in between the peaks.
def find_mode_interval(x, y, peaks):
    x = np.asarray(x)
    y = np.asarray(y)
    peak_xs = sorted(peaks)

    # Convert x-values of peaks to indices in x-grid
    peak_idxs = [np.searchsorted(x, px) for px in peaks]
    if len(peaks) == 0:
        return [(x[0], x[-1])]

    valleys = []
    for i in range(len(peaks) - 1):
        start = peak_idxs[i]
        end = peak_idxs[i + 1]
        valley_idx = start + np.argmin(y[start : end + 1])
        valleys.append(valley_idx)

    edges = [0] + valleys + [len(x) - 1]
    intervals = [(x[edges[i]], x[edges[i + 1]]) for i in range(len(edges) - 1)]
    return intervals, peak_xs


# Split a data series into multiple data series, one per mode
def split_per_mode(data, intervals):
    assignments = []
    for val in data:
        for i, (start, end) in enumerate(intervals):
            if start <= val <= end:
                assignments.append(i)
                break
        else:
            assignments.append(None)
    return np.array(assignments)


# Determine the difference of median, and a confidence interval for this
# difference of median of two distributions. This is only meaningful of
# the data is unimodal (or even normally distributed). Symmetry of the
# distribution isn't required
def bootstrap_median_diff_ci(a, b, n_iter=1000, alpha=0.05):
    data = (a, b)
    res = bootstrap(
        data,
        statistic=lambda *args: np.median(args[1]) - np.median(args[0]),
        n_resamples=n_iter,
        confidence_level=1 - alpha,
        method="percentile",  # percentile doesn't require symmetry
        vectorized=False,
        paired=False,
        random_state=None,
    )
    return np.median(b) - np.median(a), res.confidence_interval


# https://openpublishing.library.umass.edu/pare/article/1977/galley/1980/view/
# for the thresholds (table 2)
def interpret_effect_size(effect_size):
    if abs(effect_size) < 0.15:
        return "Negligible difference"
    elif abs(effect_size) < 0.33:
        return "Small difference"
    elif abs(effect_size) < 0.47:
        return "Moderate difference"
    else:
        return "Large difference"


# Normality test. using Shapiro-Wilk based on this:
# https://stats.stackexchange.com/a/129826, there's a host of methods
# we could use, but Shapiro-Wilk seem to be a good bet
# Basic statistics, normality test"
# <https://en.wikipedia.org/wiki/Shapiro%E2%80%93Wilk_test>


def interpret_normality_shapiro_wilk(base, new, header, pvalue_threshold):
    base_name = "Base Reversion"
    stat_base, p_base = stats.shapiro(base)
    is_normal_base = True if p_base > pvalue_threshold else False
    interpretation_base = f"Shapiro-Wilk result: {p_base:.2f}, {base_name} is {'**likely normal**' if p_base > pvalue_threshold else '**not normal**'}"

    new_rev_name = "With Patch"
    stat_new, p_new = stats.shapiro(new)
    is_normal_new = True if p_base > pvalue_threshold else False
    interpretation_new = f"Shapiro-Wilk result: {p_new:.2f}, {new_rev_name} is {'**likely normal**' if p_new > pvalue_threshold else '**not normal**'}"

    shapiro_results_base = {
        "test_name": "Shapiro-Wilk",
        "shapiro_stat": stat_base,
        "pvalue": p_base,
        "interpretation": interpretation_base,
        "is_normal": is_normal_base,
    }

    shapiro_results_with = {
        "test_name": "Shapiro-Wilk",
        "shapiro_stat": stat_new,
        "pvalue": p_new,
        "interpretation": interpretation_new,
        "is_normal": is_normal_new,
    }

    # Is both with patch and without patch normal?
    if is_normal_base and is_normal_new:
        is_both_normal = True
    else:
        is_both_normal = False

    return shapiro_results_base, shapiro_results_with, is_both_normal


# Kolmogorov-Smirnov test for goodness of fit
def interpret_ks_test(base, new, pvalue_threshold):
    ks_stat, ks_p = ks_2samp(base, new)
    ks_comment = f"KS test p-value: {ks_p:.4f}"

    ks_test = {
        "test_name": "Kolmogorov-Smirnov",
        "ks_stat": ks_stat,
        "pvalue": ks_p,
        "comment": ks_comment,
    }

    is_fit_good = True
    ks_warning = None

    if ks_p < pvalue_threshold:
        ks_warning = (
            "⚠️ Distributions seem to differ (KS test). Review KDE before drawing conclusions."
        )
        ks_test["warning"] = ks_warning

        is_fit_good = False

    return ks_test, is_fit_good, ks_warning


# Mann-Whitney U test
# Tests the null hypothesis that the distributions patch and without patch are identical.
# Null hypothesis is a statement that there is no significant difference or effect in population, calculates p-value
def interpret_mann_whitneyu(base, new):
    mann_stat, mann_pvalue = mannwhitneyu(base, new, alternative="two-sided")
    mann_whitney = {
        "test_name": "Mann-Whitney U",
        "stat": mann_stat,
        "pvalue": mann_pvalue,
    }
    return mann_whitney, mann_stat, mann_pvalue


def is_new_better(delta_value, lower_is_better):
    """This method returns if the new result is better or worse (even if unsure)"""
    is_new_better = None
    if abs(delta_value) < 0.001:
        direction = "neutral"
    elif (lower_is_better and delta_value < 0) or (not lower_is_better and delta_value > 0):
        direction = "better"
        is_new_better = True
    else:
        direction = "worse"
        is_new_better = False
    return direction, is_new_better


# Common Language Effect Size, and its interpretation in english
def interpret_cles(
    mann_stat,
    mann_pvalue,
    new_revision,
    base_revision,
    pvalue_threshold,
    interpretation,
    delta,
):
    cles = mann_stat / (len(new_revision) * len(base_revision))
    cles_direction = (
        f"{cles:.2f} → {cles * 100:.0f}% chance a value from `base` is greater than a value from `new`"
        if cles >= 0.5
        else f"{1 - cles:.2f} → {100 - cles * 100:.0f}% chance a value from `new` is greater than a value from `base`"
    )

    is_significant = False if mann_pvalue > pvalue_threshold else True

    common_language_effect_size = {
        "cles": cles,
        "cles_direction": cles_direction,
        "cles_interpretation": interpretation,
        "comments": [
            f"**Mann-Whitney U Common Language Effect Size**: {cles_direction}",
            f"**p-value**: {mann_pvalue:.3f}, {'not' if mann_pvalue > pvalue_threshold else ''} significant",
            f"**Cliff's Delta**: {delta:.2f} → {interpretation}",
        ],
        "is_significant": is_significant,
    }
    return common_language_effect_size, cles, is_significant


def interpret_silverman_kde(base, new):
    # Kernel Density Estimator (KDE) - estimate the probability density function (PDF) of a continuous random variable in a smooth, non-parametric way, based on a finite sample of data.
    x_base, y_base = FFTKDE(kernel="gaussian", bw="silverman").fit(base).evaluate()
    x_new, y_new = FFTKDE(kernel="gaussian", bw="silverman").fit(new).evaluate()

    # Estimate modes, and warn if multimodal. We estimate the modes w/ a bandwidth computed via silverman's method because it smoothes a bit more
    base_mode_count, base_peak_locs, base_prom = count_modes(x_base, y_base)
    new_mode_count, new_peak_locs, new_prom = count_modes(x_new, y_new)

    warning_msgs = []
    if base_mode_count > 1:
        warning_msgs.append("⚠️  Warning: Base revision distribution appears multimodal!")
    if new_mode_count > 1:
        warning_msgs.append("⚠️  Warning: New revision distribution appears multimodal!")
    # May be over or under smoothing
    if base_mode_count != new_mode_count:
        warning_msgs.append(
            "⚠️  Warning: mode count between base and new revision different, look at the KDE!"
        )

    silverman_kde = {
        "bandwidth": "Silverman",
        "base_mode_count": base_mode_count,
        "base_peak_locs": base_peak_locs,
        "base_prom": base_prom,
        "new_mode_count": new_mode_count,
        "new_peak_locs": new_peak_locs,
        "new_prom": new_prom,
        "mode_comments": [
            f"Estimated modes (Base): {base_mode_count} (location: {base_peak_locs}, prominence: {base_prom})",
            f"Estimated modes (New): {new_mode_count} (location: {new_peak_locs}, prominence: {new_prom})",
        ],
        "warnings": warning_msgs,
    }

    # Interperet confidence interval and data
    is_regression = False
    is_improvement = False

    more_runs_are_needed = False

    ci_warning = None
    if base_mode_count == new_mode_count:
        base_intervals = find_mode_interval(x_base, y_base, base_peak_locs)
        new_intervals = find_mode_interval(x_new, y_new, new_peak_locs)
        per_mode_base = split_per_mode(base, base_intervals)
        per_mode_new = split_per_mode(new, new_intervals)
        for i, (start, end) in enumerate(base_intervals):
            ref_vals = base[per_mode_base == i]
            new_vals = new[per_mode_new == i]

            if len(ref_vals) == 0 or len(new_vals) == 0:
                ci_warning = f"Mode {i + 1} [{start:.2f}, {end:.2f}]: Not enough data to compare."
                more_runs_are_needed = True
                silverman_kde["warning"] = ci_warning
                continue

            shift, (ci_low, ci_high) = bootstrap_median_diff_ci(ref_vals, new_vals)

            silverman_kde["confidence_interval"] = {
                "ci_low": ci_low,
                "ci_high": ci_high,
                "shift": shift,
            }
            print(f"Mode {i + 1} [{start:.2f}, {end:.2f}]:")
            print(f"  Median shift: {shift:+.3f} (95% CI: {ci_low:+.3f} to {ci_high:+.3f})")
            print("  → Interpretation: ", end="")
            mode_summary = f"Mode {i + 1} [{start:.2f}, {end:.2f}]"
            median_shift_summary = (
                f"Median shift: {shift:+.3f} (95% CI: {ci_low:+.3f} to {ci_high:+.3f})"
            )
            silverman_kde["mode_summary"] = mode_summary
            silverman_kde["median_shift_summary"] = median_shift_summary

            if ci_low > 0:
                is_regression = True
                ci_intepretation = "Performance regressed (median increased)"
            elif ci_high < 0:
                is_improvement = True
                ci_intepretation = "Performance improved (median decreased)"
            else:
                is_meaningful = False
                silverman_kde["is_meaningful"] = is_meaningful
                ci_intepretation = "No significant shift"

            silverman_kde["shift_summary"] = ci_intepretation

    return (
        silverman_kde,
        is_regression,
        is_improvement,
        more_runs_are_needed,
    )


# Kernel Density Estimator (KDE) with an ISJ (Improved Sheather-Jones) bandwidth for complex or multimodal data distributions.
# Plot KDE with ISJ bandwidth
def plot_kde_with_isj_bandwidth(base, new, mann_pvalue, cles, delta, interpretation):
    x1 = base
    x2 = new
    padding = 0.05 * (x1.max() - x1.min() + x2.max() - x2.min()) / 2
    x_min = min(x1.min(), x2.min()) - padding
    x_max = max(x1.max(), x2.max()) + padding
    x_vals = np.linspace(x_min, x_max, 1000)

    # KDE with ISJ bandwidth (Scipy uses Silverman/Scott by default)
    kde1 = FFTKDE(bw="ISJ").fit(x1)
    kde2 = FFTKDE(bw="ISJ").fit(x2)
    grid = np.linspace(x_min, x_max, 1000)
    y1 = kde1.evaluate(grid)
    y2 = kde2.evaluate(grid)
    x_kde = grid

    # Fill overlap
    overlap = np.minimum(y1, y2)

    plot_kde_with_isj = {"bandwidth": "Improved Sheather-Jones", "kernel": "Gaussian"}

    base_kde_isj = {
        "x": x_kde,
        "y": y1,
        "title": "Base Revision Kernel Density Estimate (KDE)",
        "bandwidth": "Improved Sheather-Jones",
        "kernel": "Gaussian",
        "xlabel": "Value",
        "ylabel": "Density",
        "overlap": overlap,
        "x_kde": x_kde,
    }

    new_kde_isj = {
        "x": x_kde,
        "y": y2,
        "title": "New Revision Kernel Density Estimate (KDE)",
        "bandwidth": "Improved Sheather-Jones",
        "kernel": "Gaussian",
        "xlabel": "Value",
        "ylabel": "Density",
        "overlap": overlap,
        "x_kde": x_kde,
    }
    # Medians as dashed lines, same colors
    plot_kde_with_isj["median_lines"] = {
        "median_base": np.median(x1),
        "median_new": np.median(x2),
    }
    plot_kde_with_isj["x_vals"] = x_vals
    # Summary text
    plot_kde_with_isj["summary_text_ISJ"] = [
        f"p-value: {mann_pvalue:.3f}\n",
        f"CLES: {cles:.2f} → {'base > new' if cles >= 0.5 else 'new > base'}\n",
        f"Cliff’s delta: {delta:.2f} → {interpretation}",
    ]

    plot_kde_with_isj["ylabel"] = "Density"
    plot_kde_with_isj["xlabel"] = "Value"
    plot_kde_with_isj["title"] = "Distribution Comparison (KDE)"
    plot_kde_with_isj["label_texts"] = [
        f"p-value: {mann_pvalue:.3f}\n",
        f"CLES: {cles:.2f} → {'base > new' if cles >= 0.5 else 'new > base'}\n",
        f"Cliff’s delta: {delta:.2f} → {interpretation}",
    ]
    plot_kde_with_isj["base_kde_ISJ"] = base_kde_isj
    plot_kde_with_isj["new_kde_ISJ"] = new_kde_isj

    return plot_kde_with_isj
