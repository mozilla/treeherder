import numpy as np
from KDEpy import FFTKDE
from scipy import stats
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from scipy.stats import bootstrap, iqr, ks_2samp, mannwhitneyu

# New Stats Code

# p-value threshold to use throughout
PVALUE_THRESHOLD = 0.05
# whether or not remove outliers using https://en.wikipedia.org/wiki/Interquartile_range
ENABLE_REMOVE_OUTLIERS = False


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
    if data is None or len(data) == 0:
        return np.array([])
    assignments = []
    for val in data:
        assigned = False
        for i, interval in enumerate(intervals):
            if len(interval) != 2:
                return None
            start, end = interval
            if start <= val <= end:
                assignments.append(i)
                assigned = True
                break
        if not assigned:
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


# Normality test. using Shapiro-Wilk based on this:
# https://stats.stackexchange.com/a/129826, there's a host of methods
# we could use, but Shapiro-Wilk seem to be a good bet
# Basic statistics, normality test"
# <https://en.wikipedia.org/wiki/Shapiro%E2%80%93Wilk_test>


def interpret_normality_shapiro_wilk(base, new, pvalue_threshold):
    warning = None
    stat_base = None
    interpretation_base = ""
    is_base_normal = None
    stat_new = None
    interpretation_new = ""
    is_new_normal = None

    if len(base) < 3:
        warning = "data must be at least length 3."

    else:
        base_name = "Base Reversion"
        stat_base, p_base = stats.shapiro(base)
        is_base_normal = True if p_base > pvalue_threshold else False
        interpretation_base = f"Shapiro-Wilk result: {p_base:.2f}, {base_name} is {'**likely normal**' if p_base > pvalue_threshold else '**not normal**'}"
    if len(new) < 3:
        warning = "data must be at least length 3."
        return None, warning
    else:
        new_rev_name = "New Reversion"
        stat_new, p_new = stats.shapiro(new)
        is_new_normal = True if p_new > pvalue_threshold else False
        interpretation_new = f"Shapiro-Wilk result: {p_new:.2f}, {new_rev_name} is {'**likely normal**' if p_new > pvalue_threshold else '**not normal**'}"

        shapiro_results = {
            "test_name": "Shapiro-Wilk",
            "shapiro_stat_base": stat_base,
            "interpretation_base": interpretation_base,
            "is_base_normal": is_base_normal,
            "shapiro_stat_new": stat_new,
            "interpretation_new": interpretation_new,
            "is_new_normal": is_new_normal,
        }

    return shapiro_results, warning


# Kolmogorov-Smirnov test for goodness of fit
def interpret_ks_test(base, new, pvalue_threshold):
    ks_stat, ks_p = ks_2samp(base, new)
    ks_comment = f"KS test p-value: {ks_p:.4f}"

    ks_test = {
        "test_name": "Kolmogorov-Smirnov",
        "stat": float(ks_stat),
        "interpretation": ks_comment,
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
        "stat": float(mann_stat),
        "pvalue": float(mann_pvalue),
    }
    return mann_whitney, mann_stat, mann_pvalue


def is_new_better(delta_value, lower_is_better):
    """This method returns if the new result is better or worse (even if unsure)"""
    is_new_better = None
    if abs(delta_value) < 0.001:
        direction = "no change"
    elif (lower_is_better and delta_value < 0) or (not lower_is_better and delta_value > 0):
        direction = "better"
        is_new_better = True
    else:
        direction = "worse"
        is_new_better = False
    return direction, is_new_better


def interpret_cles_direction(cles, pvalue_threshold=PVALUE_THRESHOLD):
    if cles >= pvalue_threshold:
        return f"{cles:.0%} chance a base value is greater than a new value"
    else:
        return f"{1 - cles:.0%} chance a new value is greater than a base value"


# https://openpublishing.library.umass.edu/pare/article/1977/galley/1980/view/
def interpret_effect_size(delta):
    if abs(delta) < 0.15:
        return "negligible"
    elif abs(delta) < 0.33:
        return "small"
    elif abs(delta) < 0.47:
        return "moderate"
    else:
        return "large"


def interpret_performance_direction(ci_low, ci_high, lower_is_better):
    is_regression = False
    is_improvement = False

    if ci_low > 0:
        if lower_is_better:
            is_regression = False
            is_improvement = True
            ci_intepretation = "Performance improved (median increased)"
        else:
            is_regression = True
            is_improvement = False
            ci_intepretation = "Performance regressed (median increased)"
    elif ci_high < 0:
        if lower_is_better:
            is_regression = True
            is_improvement = False
            ci_intepretation = "Performance regressed (median decreased)"
        else:
            is_regression = False
            is_improvement = True
            ci_intepretation = "Performance improved (median decreased)"
    else:
        ci_intepretation = "No significant shift"
    return is_regression, is_improvement, ci_intepretation


# Common Language Effect Size, and its interpretation in english
def interpret_cles(
    mann_stat,
    mann_pvalue,
    new_revision,
    base_revision,
    pvalue_threshold,
    interpretation,
    delta,
    lower_is_better,
):
    cles = mann_stat / (len(new_revision) * len(base_revision))

    # Mann-Whitney U Common Language Effect Size
    mann_whitney_u_cles = (
        f"{cles:.2f} → {cles * 100:.0f}% chance a value from `base` is greater than a value from `new`"
        if cles >= 0.5
        else f"{1 - cles:.2f} → {100 - cles * 100:.0f}% chance a value from `new` is greater than a value from `base`"
    )

    is_significant = False if mann_pvalue > pvalue_threshold else True

    # Generate CLES explanation
    cles_explanation = interpret_cles_direction(cles)

    # Cliff's delta CLES
    cliffs_delta_cles = f"Cliff's Delta: {delta:.2f} → {interpretation}"

    # Mann-Whitney U  p-value CLES
    p_value_cles = (
        f"{mann_pvalue:.3f}, {'not' if mann_pvalue > pvalue_threshold else ''} significant"
    )

    return (
        cles,
        is_significant,
        cles_explanation,
        mann_whitney_u_cles,
        cliffs_delta_cles,
        p_value_cles,
    )


def interpret_silverman_kde(base, new, lower_is_better):
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

    # Interperet confidence interval and data
    more_runs_are_needed = False

    ci_warning = None
    silverman_kde = None
    is_regression = None
    is_improvement = None
    performance_intepretation = None

    if base_mode_count == new_mode_count:
        base_intervals, base_peak_xs = find_mode_interval(x_base, y_base, base_peak_locs)
        new_intervals, new_peak_xs = find_mode_interval(x_new, y_new, new_peak_locs)
        per_mode_new = split_per_mode(new, new_intervals)
        per_mode_base = split_per_mode(base, base_intervals)

        for i, interval in enumerate(base_intervals):
            tup = interval
            if len(tup) != 2:
                return None, None, None, None, None, None

            start, end = tup
            shift = 0
            ci_low = 0
            ci_high = 0
            median_shift_summary = None

            try:
                ref_vals = base[per_mode_base[0] == i]
                new_vals = new[per_mode_new[0] == i]

                if len(ref_vals) == 0 or len(new_vals) == 0:
                    ci_warning = (
                        f"Mode {i + 1} [{start:.2f}, {end:.2f}]: Not enough data to compare."
                    )
                    more_runs_are_needed = True
                    continue

                shift, (ci_low, ci_high) = bootstrap_median_diff_ci(ref_vals, new_vals)
                shift = float(shift)
                ci_low = float(ci_low)
                ci_high = float(ci_high)
                median_shift_summary = (
                    f"Median shift: {shift:+.3f} (95% CI: {ci_low:+.3f} to {ci_high:+.3f})"
                )
                is_regression, is_improvement, performance_intepretation = (
                    interpret_performance_direction(ci_low, ci_high, lower_is_better)
                )
            except Exception:
                pass

            mode_summary = f"Mode {i + 1} [{start:.2f}, {end:.2f}]"

        silverman_kde = {
            "bandwidth": "Silverman",
            "base_mode_count": base_mode_count,
            "new_mode_count": new_mode_count,
            "mode_comments": [
                f"Estimated modes (Base): {base_mode_count} (location: {base_peak_locs}, prominence: {base_prom})",
                f"Estimated modes (New): {new_mode_count} (location: {new_peak_locs}, prominence: {new_prom})",
            ],
            "warnings": warning_msgs,
            "mode_summary": mode_summary,
            "median_shift_summary": median_shift_summary,
            "ci_low": float(ci_low),
            "ci_high": float(ci_high),
            "shift": float(shift),
            "shift_summary": performance_intepretation,
            "is_regression": is_regression,
            "is_improvement": is_improvement,
            "ci_warning": ci_warning,
        }

    return (
        silverman_kde,
        is_regression,
        is_improvement,
        more_runs_are_needed,
        warning_msgs,
        performance_intepretation,
    )


# Kernel Density Estimator (KDE) with an ISJ (Improved Sheather-Jones) bandwidth for complex or multimodal data distributions.
# Plot KDE with ISJ bandwidth
def plot_kde_with_isj_bandwidth(base, new, mann_pvalue, cles, delta, interpretation):
    # Median lines
    base_median = np.median(base) if len(base) > 0 else 0
    new_median = np.median(new) if len(new) > 0 else 0

    # Determine range for KDE
    all_data = (
        np.concatenate([base, new])
        if len(base) > 0 and len(new) > 0
        else (base if len(base) > 0 else new)
    )
    x_min, x_max = np.min(all_data), np.max(all_data)
    padding = 0.05 * (x_max - x_min) if x_max > x_min else 1
    x_min, x_max = x_min - padding, x_max + padding

    # Generate grid points
    x_grid = np.linspace(x_min, x_max, 200)

    kde_x_base = []
    kde_y_base = []
    kde_x_new = []
    kde_y_new = []

    try:
        if len(base) > 1:
            kde_base = FFTKDE(bw="ISJ").fit(base)
            y_base = kde_base.evaluate(x_grid)
            kde_x_base = x_grid.tolist()
            kde_y_base = y_base.tolist()

        if len(new) > 1:
            kde_new = FFTKDE(bw="ISJ").fit(new)
            y_new = kde_new.evaluate(x_grid)
            kde_x_new = x_grid.tolist()
            kde_y_new = y_new.tolist()

    except Exception:
        # KDE failed, charts will show just medians
        pass

    # Summary text
    isj_kde_summary_text = [
        f"p-value: {mann_pvalue:.3f}",
        f"CLES: {cles:.2f} → {'base > new' if cles >= 0.5 else 'new > base'}",
        f"Cliff’s delta: {delta:.2f} → {interpretation}",
    ]

    dke_isj_plot_base = {
        "median": float(base_median),
        "sample_count": len(base),
        "kde_x": kde_x_base,
        "kde_y": kde_y_base,
    }
    dke_isj_plot_new = {
        "median": float(new_median),
        "sample_count": len(new),
        "kde_x": kde_x_new,
        "kde_y": kde_y_new,
    }

    return dke_isj_plot_base, dke_isj_plot_new, isj_kde_summary_text
