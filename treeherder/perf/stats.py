import warnings

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
    try:
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
    except Exception:
        return 0, None, None


# Return a list of interval correspondings to the modes in the data series,
# from a KDE of the data and the location of the peaks. To do this, we find
# the valleys (minimums) in between the peaks.
def find_mode_interval(x, y, peaks):
    try:
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
    except Exception:
        return [], None


# Split a data series into multiple data series, one per mode
def split_per_mode(data, intervals):
    try:
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
    except Exception:
        return []


# Determine the difference of median, and a confidence interval for this
# difference of median of two distributions. This is only meaningful of
# the data is unimodal (or even normally distributed). Symmetry of the
# distribution isn't required
def bootstrap_median_diff_ci(a, b, n_iter=1000, alpha=0.05):
    try:
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
    except Exception:
        return None, (None, None)


# Normality test. using Shapiro-Wilk based on this:
# https://stats.stackexchange.com/a/129826, there's a host of methods
# we could use, but Shapiro-Wilk seem to be a good bet
# Basic statistics, normality test"
# <https://en.wikipedia.org/wiki/Shapiro%E2%80%93Wilk_test>


def interpret_normality_shapiro_wilk(base, new, pvalue_threshold=PVALUE_THRESHOLD):
    try:
        warnings = []

        stat_base = None
        interpretation_base = ""
        is_base_normal = None
        p_base = None
        stat_new = None
        interpretation_new = ""
        is_new_normal = None
        p_new = None
        base_name = "Base Revision"

        shapiro_results_base = {
            "test_name": "Shapiro-Wilk",
            "stat": None,
            "pvalue": None,
            "interpretation": interpretation_base,
        }

        shapiro_results_new = {
            "test_name": "Shapiro-Wilk",
            "stat": None,
            "pvalue": None,
            "interpretation": interpretation_new,
        }
        # shapiro needs minimum 3 data points else NaN values returns
        if len(base) >= 3:
            try:
                with warnings.catch_warnings():
                    stat_base, p_base = stats.shapiro(base)
                    if not np.isnan(p_base):
                        is_base_normal = p_base > pvalue_threshold
                        shapiro_results_base["stat"] = float(stat_base)
                        shapiro_results_base["pvalue"] = float(p_base)
                        shapiro_results_base["interpretation"] = (
                            f"Shapiro-Wilk result: {p_base:.2f}, {base_name} is {'**likely normal**' if is_base_normal else '**not normal**'}"
                        )
                        if not is_base_normal:
                            warnings.append("Base is not normal.")
            except Exception:
                warnings.append(
                    "Cannot compute Shapiro-Wilk test for base. Likely not enough data."
                )
        else:
            warnings.append(
                "Shapiro-Wilk test cannot be run on Base with fewer than 3 data points."
            )
            shapiro_results_base["interpretation"] = "Not enough data for normality test."

        new_rev_name = "New Revision"
        if len(new) >= 3:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", category=UserWarning)
                    stat_new, p_new = stats.shapiro(new)
                if not np.isnan(p_new):
                    is_new_normal = p_new > pvalue_threshold
                    shapiro_results_new["stat"] = float(stat_new)
                    shapiro_results_new["pvalue"] = float(p_new)
                    shapiro_results_new["interpretation"] = (
                        f"Shapiro-Wilk result: {p_new:.2f}, {new_rev_name} is {'**likely normal**' if is_new_normal else '**not normal**'}"
                    )
                    if not is_new_normal:
                        warnings.append("Warning, new is not normal")
            except Exception:
                warnings.append("Cannot compute Shapiro-Wilk test for new. Likely not enough data.")
        else:
            warnings.append("Shapiro-Wilk test cannot be run on New with fewer than 3 data points.")
            shapiro_results_new["interpretation"] = "Not enough data for normality test"

        return shapiro_results_base, shapiro_results_new, warnings
    except Exception:
        return None, None, []


# Kolmogorov-Smirnov test for goodness of fit
def interpret_ks_test(base, new, pvalue_threshold=PVALUE_THRESHOLD):
    try:
        if len(base) < 1 or len(new) < 1:
            return None, None, None

        ks_stat, ks_p = ks_2samp(base, new)
        ks_warning = None
        ks_comment = None
        is_fit_good = None

        if ks_p > pvalue_threshold:
            ks_comment = f"KS test p-value: {ks_p:.3f}, good fit"
            is_fit_good = True
        else:
            ks_warning = (
                "Distributions seem to differ (KS test). Review KDE before drawing conclusions."
            )
            ks_comment = f"KS test p-value: {ks_p:.3f}, poor fit"
            is_fit_good = False

        ks_test = {
            "test_name": "Kolmogorov-Smirnov",
            "stat": float(ks_stat) if ks_stat else None,
            "pvalue": float(ks_p) if ks_p else None,
            "interpretation": ks_comment,
        }

        return ks_test, is_fit_good, ks_warning
    except Exception:
        return None, None, None


def mann_whitney_pval_significance(mann_pvalue, pvalue_threshold=PVALUE_THRESHOLD):
    p_value_interpretation = None
    is_significant = False

    if mann_pvalue > pvalue_threshold:
        p_value_interpretation = "not significant"
    if mann_pvalue <= pvalue_threshold:
        is_significant = True
        p_value_interpretation = "significant"
    return p_value_interpretation, is_significant


# Mann-Whitney U test
# Tests the null hypothesis that the distributions patch and without patch are identical.
# Null hypothesis is a statement that there is no significant difference or effect in population, calculates p-value
def interpret_mann_whitneyu(base, new, pvalue_threshold=PVALUE_THRESHOLD):
    if len(base) < 1 or len(new) < 1:
        return None, None, 0
    mann_stat, mann_pvalue = mannwhitneyu(base, new, alternative="two-sided")
    mann_stat = float(mann_stat) if mann_stat else None
    mann_pvalue = float(mann_pvalue) if mann_pvalue else None
    # Mann-Whitney U  p-value interpretation
    p_value_interpretation, is_significant = mann_whitney_pval_significance(
        mann_pvalue, pvalue_threshold
    )

    mann_whitney = {
        "test_name": "Mann-Whitney U",
        "stat": mann_stat,
        "pvalue": mann_pvalue,
        "interpretation": p_value_interpretation,
    }
    return mann_whitney, mann_stat, mann_pvalue, is_significant


# https://openpublishing.library.umass.edu/pare/article/1977/galley/1980/view/
def interpret_effect_size(delta):
    is_effect_meaningful = False
    if delta is None:
        return "Effect cannot be interpreted", is_effect_meaningful
    if abs(delta) < 0.15:
        return "negligible", is_effect_meaningful
    if abs(delta) < 0.33:
        is_effect_meaningful = True
        return "small", is_effect_meaningful
    if abs(delta) < 0.47:
        is_effect_meaningful = True
        return "moderate", is_effect_meaningful
    else:
        is_effect_meaningful = True
        return "large", is_effect_meaningful


def interpret_cles_direction(cles, pvalue_threshold=PVALUE_THRESHOLD):
    is_base_greater = None
    if cles is None:
        return "CLES cannot be interpreted", is_base_greater
    elif cles > pvalue_threshold:
        is_base_greater = True
        return f"{cles:.0%} chance a base value > a new value", is_base_greater
    elif cles < pvalue_threshold:
        is_base_greater = False
        return f"{1 - cles:.0%} chance a new value > base value", is_base_greater
    return "CLES cannot be interpreted", is_base_greater


def is_new_better(is_effect_meaningful, is_base_greater, is_significant, lower_is_better):
    is_new_better = None
    direction = "no change"
    # Possibility Base > than New with a small amount or more significance
    if is_base_greater and is_effect_meaningful and is_significant:
        if lower_is_better:
            is_new_better = True
            direction = "improvement"
        else:
            is_new_better = False
            direction = "regression"
    # Possibility New > Base with a small amount or more significance
    elif (is_base_greater is False) and is_effect_meaningful and is_significant:
        if lower_is_better:
            is_new_better = False
            direction = "regression"
        else:
            is_new_better = True
            direction = "improvement"
    return direction, is_new_better


def interpret_performance_direction(ci_low, ci_high, lower_is_better):
    is_regression = False
    is_improvement = False
    ci_intepretation = None
    if ci_high is None or ci_low is None:
        return None, None, None
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
    new_revision,
    base_revision,
    delta,
    interpretation,
    lower_is_better,
):
    try:
        cles = None
        if (len(new_revision) > 0) and (len(base_revision) > 0) and mann_stat:
            cles = mann_stat / (len(new_revision) * len(base_revision))
        else:
            return None, None, None, None, None, None

        mann_whitney_u_cles = ""
        # Mann-Whitney U Common Language Effect Size
        if cles:
            mann_whitney_u_cles = (
                f"{cles:.2f} → {cles * 100:.0f}% chance a value from `base` is greater than a value from `new`"
                if cles >= 0.5
                else f"{1 - cles:.2f} → {100 - cles * 100:.0f}% chance a value from `new` is greater than a value from `base`"
            )
        else:
            mann_whitney_u_cles = ""

        # Generate CLES explanation
        cles_explanation, is_base_greater = interpret_cles_direction(cles) if cles else "", None
        # Cliff's delta CLES
        cliffs_delta_cles = f"Cliff's Delta: {delta:.2f} → {interpretation}" if delta else ""

        cles_obj = {
            "cles": cles,
            "cles_explanation": cles_explanation,
            "mann_whitney_u_cles": mann_whitney_u_cles,
            "cliffs_delta_cles": cliffs_delta_cles,
        }

        return (
            cles_obj,
            cles,
            cles_explanation,
            mann_whitney_u_cles,
            cliffs_delta_cles,
            is_base_greater,
        )
    except Exception:
        return None, None, None, None, None, None


def interpret_silverman_kde(base_data, new_data, lower_is_better):
    try:
        warning_msgs = []
        base_mode_count, base_peak_locs, base_prom = 0, None, None
        new_mode_count, new_peak_locs, new_prom = 0, None, None
        x_base, y_base = [], []
        x_new, y_new = [], []
        # Kernel Density Estimator (KDE) - estimate the probability density function (PDF) of a continuous random variable in a smooth, non-parametric way, based on a finite sample of data.
        # 1 datapoint will result in a Bandwidth = 0 → divide-by-zero warning
        if len(base_data) > 0:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", category=UserWarning)
                    x_base, y_base = (
                        FFTKDE(kernel="gaussian", bw="silverman").fit(base_data).evaluate()
                    )
                    base_mode_count, base_peak_locs, base_prom = count_modes(x_base, y_base)
            except Exception:
                warning_msgs.append(
                    "Cannot compute Silverman KDE for base. Likely not enough data."
                )
        else:
            warning_msgs.append("Base revision has less than 2 data points to run Silverman KDE.")
        if len(new_data) > 0:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", category=UserWarning)
                    x_new, y_new = (
                        FFTKDE(kernel="gaussian", bw="silverman").fit(new_data).evaluate()
                    )
                    new_mode_count, new_peak_locs, new_prom = count_modes(x_new, y_new)
            except Exception:
                warning_msgs.append("Cannot compute Silverman KDE for new. Likely not enough data.")
        else:
            warning_msgs.append("New revision has less than 2 data points to run Silverman KDE.")

        # Estimate modes, and warn if multimodal. We estimate the modes w/ a bandwidth computed via silverman's method because it smoothes a bit more

        if base_mode_count > 1:
            warning_msgs.append("Base revision distribution appears multimodal.")
        if new_mode_count > 1:
            warning_msgs.append("New revision distribution appears multimodal.")
        # May be over or under smoothing
        if base_mode_count != new_mode_count:
            warning_msgs.append(
                "Mode count between base and new revision different, look at the KDE."
            )

        # Interperet confidence interval and data
        more_runs_are_needed = False

        ci_warning = None
        silverman_kde = None
        is_regression = None
        is_improvement = None
        performance_intepretation = None
        modes = []
        base_intervals, base_peak_xs = find_mode_interval(x_base, y_base, base_peak_locs)
        new_intervals, new_peak_xs = find_mode_interval(x_new, y_new, new_peak_locs)
        for i, interval in enumerate(base_intervals):
            tup = interval
            if len(tup) != 2:
                return None, None, None, None, None, None

            start, end = tup
            shift = 0
            ci_low = 0
            ci_high = 0
            median_shift_summary = (
                "Cannot measure shift, base mode count not equal to new mode count"
            )
            shift = None
            mode_name = f"Mode {i + 1}"
            mode_info = {
                "mode_name": mode_name,
                "mode_start": f"{start:.2f}" if start else None,
                "mode_end": f"{end:.2f}" if end else None,
                "median_shift_summary": median_shift_summary,
                "ci_low": ci_low,
                "ci_high": ci_high,
                "shift": shift,
                "shift_summary": performance_intepretation,
                "ci_warning": ci_warning,
            }

            if base_mode_count == new_mode_count:
                per_mode_new = split_per_mode(new_data, new_intervals)
                per_mode_base = split_per_mode(base_data, base_intervals)

                try:
                    ref_vals = [val for val, mode in zip(base_data, per_mode_base) if mode == i]
                    new_vals = [val for val, mode in zip(new_data, per_mode_new) if mode == i]

                    if len(ref_vals) == 0 or len(new_vals) == 0:
                        ci_warning = (
                            f"Mode {i + 1} [{start:.2f}, {end:.2f}]: Not enough data to compare."
                        )
                        warning_msgs.append(ci_warning)
                        more_runs_are_needed = True
                        continue

                    shift, (ci_low, ci_high) = bootstrap_median_diff_ci(ref_vals, new_vals)
                    shift = float(shift) if shift else None
                    ci_low = float(ci_low) if ci_low else None
                    ci_high = float(ci_high) if ci_high else None
                    median_shift_summary = (
                        f"Median shift: {shift:+.3f} (95% CI: {ci_low:+.3f} to {ci_high:+.3f})"
                    )
                    is_regression, is_improvement, performance_intepretation = (
                        interpret_performance_direction(ci_low, ci_high, lower_is_better)
                    )
                except Exception:
                    pass

                mode_info = {
                    "mode_name": mode_name,
                    "mode_start": f"{start:.2f}" if start else None,
                    "mode_end": f"{end:.2f}" if end else None,
                    "median_shift_summary": median_shift_summary,
                    "ci_low": ci_low,
                    "ci_high": ci_high,
                    "shift": shift,
                    "shift_summary": performance_intepretation,
                    "ci_warning": ci_warning,
                }

                modes.append(mode_info)

        silverman_kde = {
            "bandwidth": "Silverman",
            "base_mode_count": base_mode_count,
            "new_mode_count": new_mode_count,
            "base_locations": base_peak_locs,
            "new_locations": new_peak_locs,
            "base_prominence": round(float(base_prom), 5) if base_prom else None,
            "new_prominence": round(float(new_prom), 5) if new_prom else None,
            "modes": modes,
            "is_regression": is_regression,
            "is_improvement": is_improvement,
        }
        return (
            silverman_kde,
            is_regression,
            is_improvement,
            more_runs_are_needed,
            warning_msgs,
            performance_intepretation,
        )
    except Exception:
        return None, None, None, None, [], None


# Kernel Density Estimator (KDE) with an ISJ (Improved Sheather-Jones) bandwidth for complex or multimodal data distributions.
# Plot KDE with ISJ bandwidth
def plot_kde_with_isj_bandwidth(base, new):
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
    x_grid = np.linspace(x_min, x_max, 256)

    kde_x_base = []
    kde_y_base = []
    kde_x_new = []
    kde_y_new = []
    kde_warnings = []

    kde_plot_base = {
        "median": float(base_median),
        "sample_count": len(base) if base else 0,
        "kde_x": kde_x_base,
        "kde_y": kde_y_base,
    }
    kde_plot_new = {
        "median": float(new_median),
        "sample_count": len(new) if new else 0,
        "kde_x": kde_x_new,
        "kde_y": kde_y_new,
    }

    try:
        # min 2 data point. FFTKDE(bw="ISJ").fit measure the data's spread or variance. At less than 2, variance is undefined, cannot compute a bandwidth.
        if len(base) > 1 and np.std(base) != 0:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    kde_base = FFTKDE(bw="ISJ").fit(base)
                    y_base = kde_base.evaluate(x_grid)
                    kde_x_base = x_grid.tolist()
                    kde_y_base = y_base.tolist()
                    kde_plot_base["kde_x"] = kde_x_base
                    kde_plot_base["kde_y"] = kde_y_base
            except Exception:
                kde_warnings.append(
                    "KDE with ISJ bandwidth fitting to Base data failed. Likely not enough data or no standard deviation in data."
                )
                kde_plot_base["kde_x"] = base
        else:
            kde_warnings.append(
                "Less than 2 datapoints or no standard variance for a meaningful fit Kernel Density Estimator (KDE) with an ISJ bandwidth to Base."
            )
            # produce flat line for 0 data points
            if len(base) == 0:
                x = np.linspace(-1, 1, 100)
                y = np.zeros_like(x)
                kde_plot_base["kde_x"] = x.tolist()
                kde_plot_base["kde_y"] = y.tolist()
            else:
                kde_plot_base["kde_x"] = base
                kde_plot_base["kde_y"] = []

        if len(new) > 1 and np.std(new) != 0:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    kde_new = FFTKDE(bw="ISJ").fit(new)
                    y_new = kde_new.evaluate(x_grid)
                    kde_x_new = x_grid.tolist()
                    kde_y_new = y_new.tolist()
                    kde_plot_new["kde_x"] = kde_x_new
                    kde_plot_new["kde_y"] = kde_y_new
            except Exception:
                kde_warnings.append(
                    "KDE with ISJ bandwidth fitting to New data failed. Likely not enough data or no standard deviation in data."
                )
                kde_plot_new["kde_x"] = new
        else:
            kde_warnings.append(
                "Less than 2 datapoints or no standard variance for a meaningful fit Kernel Density Estimator (KDE) with an ISJ bandwidth to New."
            )
            # produce flat line for 0 data points
            if len(new) == 0:
                x = np.linspace(-1, 1, 100)
                y = np.zeros_like(x)
                kde_plot_new["kde_x"] = x.tolist()
                kde_plot_new["kde_y"] = y.tolist()
            else:
                kde_plot_new["kde_x"] = new

    except Exception:
        # KDE failed, charts will show just medians
        pass

    return kde_plot_base, kde_plot_new, kde_warnings
