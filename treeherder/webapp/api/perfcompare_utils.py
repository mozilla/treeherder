import functools
from math import sqrt
from statistics import mean, stdev, median
from treeherder.perf.models import (
    OptionCollection,
)

""" Constants """

NOISE_METRIC_HEADER = 'noise metric'
"""
Default stddev is used for get_ttest_value if both sets have only a single value - 15%.
Should be rare case and it's unreliable, but at least we have something.
"""
STDDEV_DEFAULT_FACTOR = 0.15
T_VALUE_CARE_MIN = 3  # Anything below this is "low" in confidence
T_VALUE_CONFIDENCE = 5  # Anything above this is "high" in confidence
PERFHERDER_TIMERANGES = [
    {'value': 86400, 'text': 'Last day'},
    {'value': 86400 * 2, 'text': 'Last 2 days'},
    {'value': 604800, 'text': 'Last 7 days'},
    {'value': 1209600, 'text': 'Last 14 days'},
    {'value': 2592000, 'text': 'Last 30 days'},
    {'value': 5184000, 'text': 'Last 60 days'},
    {'value': 7776000, 'text': 'Last 90 days'},
    {'value': 31536000, 'text': 'Last year'},
]

""" Helpers """


def get_test_suite(suite, test):
    return suite if test == '' or test == suite else '{} {}'.format(suite, test)


def get_header_name(extra_options, option_name, test_suite):
    name = '{} {} {}'.format(test_suite, option_name, extra_options)
    return name


def get_sig_identifier(header, platform):
    return '{} {}'.format(header, platform)


def get_option_collection_map():
    option_collection = OptionCollection.objects.select_related('option').values(
        'id', 'option__name'
    )
    option_collection_map = {item['id']: item['option__name'] for item in list(option_collection)}
    return option_collection_map


""" Standard deviation and standard deviation percentage """


def get_stddev_pct(avg, stddev):
    """
    @param avg: average of the runs values
    @param stddev: standard deviation of the runs values
    @return: standard deviation as percentage of the average
    """
    if stddev:
        return round(get_percentage(stddev, avg) * 100) / 100
    return 0


def get_stddev(values, header):
    """
    @param values: list of the runs values
    @param header: name of the header
    @return: standard deviation value or 0 in case there's only one run
             based on the metric header name
    """
    if header == NOISE_METRIC_HEADER:
        return 1
    else:
        return stdev(values) if len(values) >= 2 else 0


def get_avg(values, header):
    """
    @param values: list of the runs values
    @param header: name of the header
    @return: Mean of the runs values if there are any
    """
    if header == NOISE_METRIC_HEADER:
        return get_noise_metric_avg(values)
    else:
        return mean(values) if len(values) else 0


def get_median(values):
    """
    @param values: list of the runs values
    @return: Median of the runs values if there are any
    """
    return median(values) if len(values) else 0


def get_noise_metric_avg(values):
    return sqrt(functools.reduce(lambda a, b: a + b, map(lambda x: x**2, values)))


def get_percentage(part, whole):
    percentage = 0
    if whole:
        percentage = (100 * part) / whole
    return percentage


""" Confidence """


def get_abs_ttest_value(control_values, test_values):
    """
    If a set has only one value, assume average-ish-plus standard deviation, which
    will manifest as smaller t-value the less items there are at the group
    (so quite small for 1 value). This default value is a parameter.
    C/T mean control/test group (in our case base/new data).
    """
    length_control = len(control_values)
    length_test = len(test_values)
    if not length_control or not length_test:
        return 0
    control_group_avg = mean(control_values) if length_control else 0
    test_group_avg = mean(test_values) if length_test else 0
    stddev_control = (
        stdev(control_values) if length_control > 1 else STDDEV_DEFAULT_FACTOR * control_group_avg
    )
    stddev_test = stdev(test_values) if length_test > 1 else STDDEV_DEFAULT_FACTOR * test_group_avg
    try:
        if length_control == 1:
            stddev_control = (control_values[0] * stddev_test) / test_group_avg
        elif length_test == 1:
            stddev_test = (test_values[0] * stddev_control) / control_group_avg
    except ZeroDivisionError:
        return 0
    delta = test_group_avg - control_group_avg
    std_diff_err = sqrt(
        (stddev_control * stddev_control) / length_control  # control-variance / control-size
        + (stddev_test * stddev_test) / length_test
    )
    try:
        res = abs(delta / std_diff_err)
    except ZeroDivisionError:
        return 0
    return res


def get_confidence_text(abs_tvalue):
    if abs_tvalue == 0 or abs_tvalue is None:
        return ''
    if abs_tvalue < T_VALUE_CARE_MIN:
        confidence_text = 'Low'
    elif abs_tvalue < T_VALUE_CONFIDENCE:
        confidence_text = 'Medium'
    else:
        confidence_text = 'High'
    return confidence_text


""" Delta value, delta percentage and magnitude """


def get_delta_value(new_avg_value, base_avg_value):
    return new_avg_value - base_avg_value


def get_delta_percentage(delta_value, base_avg_value):
    return get_percentage(delta_value, base_avg_value)


def is_new_better(delta_value, lower_is_better):
    """This method returns if the new result is better or worse (even if unsure)"""
    return (lower_is_better and delta_value < 0) or (not lower_is_better and delta_value > 0)


def get_magnitude(delta_percentage):
    """Arbitrary scale from 0-20% multiplied by 5, capped at 100 (so 20% regression === 100% bad)"""
    return min(abs(delta_percentage) * 5, 100)


""" Is confident """


def is_confident(base_runs_count, new_runs_count, confidence):
    runs_count_gt_one = base_runs_count > 1 and new_runs_count > 1
    runs_count_gte_six = base_runs_count >= 6 and new_runs_count >= 6
    return (runs_count_gt_one and confidence >= T_VALUE_CONFIDENCE) or (
        runs_count_gte_six and confidence >= T_VALUE_CARE_MIN
    )


""" Needs more runs """


def more_runs_are_needed(is_complete, is_confident, base_runs_count):
    return is_complete and not is_confident and base_runs_count < 6


""" Class name """


def get_class_name(new_is_better, base_avg_value, new_avg_value, abs_t_value):
    # Returns a class name, if any, based on a relative change in the absolute value
    if not base_avg_value or not new_avg_value:
        return ''

    ratio = new_avg_value / base_avg_value
    if ratio < 1:
        ratio = 1 / ratio  # Direction agnostic and always >= 1

    if ratio < 1.02 or abs_t_value < T_VALUE_CARE_MIN:
        return ''

    if abs_t_value < T_VALUE_CONFIDENCE:
        if new_is_better:
            return ''
        return 'warning'

    if new_is_better:
        return 'success'
    else:
        return 'danger'
