import numpy as np
from scipy import stats
from scipy.stats import iqr, ks_2samp, mannwhitneyu

# New Stats Code
# various formulas extracted from here:
# https://colab.research.google.com/gist/padenot/2a408f0a39e269977045fc2fb265663b/end-to-end.ipynb#scrollTo=M8WY0yVIX5Ru&uniqifier=1

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
                stat_base, p_base = stats.shapiro(base)
                if not np.isnan(p_base):
                    is_base_normal = p_base > pvalue_threshold
                    shapiro_results_base["stat"] = float(stat_base)
                    shapiro_results_base["pvalue"] = float(p_base)
                    shapiro_results_base["interpretation"] = (
                        f"Shapiro-Wilk result: {p_base:.2f}, {base_name} is {'likely normal' if is_base_normal else 'not normal'}"
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
                stat_new, p_new = stats.shapiro(new)
                if not np.isnan(p_new):
                    is_new_normal = p_new > pvalue_threshold
                    shapiro_results_new["stat"] = float(stat_new)
                    shapiro_results_new["pvalue"] = float(p_new)
                    shapiro_results_new["interpretation"] = (
                        f"Shapiro-Wilk result: {p_new:.2f}, {new_rev_name} is {'likely normal' if is_new_normal else 'not normal'}"
                    )
                    if not is_new_normal:
                        warnings.append("New is not normal")
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
            return None, None

        ks_stat, ks_p = ks_2samp(base, new)
        ks_warning = None
        ks_comment = None

        if ks_p > pvalue_threshold:
            ks_comment = f"KS test p-value: {ks_p:.3f}, good fit"
        else:
            ks_warning = (
                "Distributions seem to differ (KS test). Review KDE before drawing conclusions."
            )
            ks_comment = f"KS test p-value: {ks_p:.3f}, poor fit"

        ks_test = {
            "test_name": "Kolmogorov-Smirnov",
            "stat": float(ks_stat) if ks_stat is not None else None,
            "pvalue": float(ks_p) if ks_p is not None else None,
            "interpretation": ks_comment,
        }

        return ks_test, ks_warning
    except Exception:
        return None, None


def mann_whitney_pval_significance(mann_pvalue, pvalue_threshold=PVALUE_THRESHOLD):
    p_value_interpretation = ""
    is_significant = False
    if mann_pvalue is None:
        return p_value_interpretation, is_significant
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
        return None, None, 0, False
    mann_stat, mann_pvalue = mannwhitneyu(base, new, alternative="two-sided")
    mann_stat = float(mann_stat) if mann_stat is not None else None
    mann_pvalue = float(mann_pvalue) if mann_pvalue is not None else None
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
    is_effect_meaningful = True
    if abs(delta) < 0.33:
        return "small", is_effect_meaningful
    if abs(delta) < 0.47:
        return "moderate", is_effect_meaningful
    return "large", is_effect_meaningful


def interpret_cles_direction(cles):
    # probability that a randomly selected score from one group will be greater than a randomly selected score from a second group
    # A CLES of 0.5 indicates a 50% chance for either outcome, 50/50 toss up, no change
    # A CLES of 0.6 would mean there is a 60% chance that a score Base > New
    # A CLES of 0.4 would mean there is a 40% chance that a score from Base > New, or a 60% chance that a score from New > Base
    is_base_greater = None
    if cles is None:
        return "CLES cannot be interpreted", is_base_greater
    elif cles > 0.5:
        is_base_greater = True
        return f"{cles:.0%} chance a base value > a new value", is_base_greater
    elif cles < 0.5:
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
        if (len(new_revision) > 0) and (len(base_revision) > 0) and mann_stat is not None:
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
        cles_explanation, is_base_greater = interpret_cles_direction(cles)
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
