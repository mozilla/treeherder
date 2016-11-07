import datetime
import time
from collections import namedtuple

from django.conf import settings
from django.db import transaction

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum)
from treeherder.perfalert import (Datum,
                                  detect_changes)


def get_alert_properties(prev_value, new_value, lower_is_better):
    AlertProperties = namedtuple('AlertProperties',
                                 'pct_change delta is_regression')
    if prev_value != 0:
        pct_change = (100.0 * abs(new_value -
                                  prev_value) /
                      float(prev_value))
    else:
        pct_change = 0.0

    delta = (new_value - prev_value)

    is_regression = ((delta > 0 and lower_is_better) or
                     (delta < 0 and not lower_is_better))

    return AlertProperties(pct_change, delta, is_regression)


def generate_new_alerts_in_series(signature):
    # get series data starting from either:
    # (1) the last alert, if there is one
    # (2) the alerts max age
    # (use whichever is newer)
    max_alert_age = (datetime.datetime.now() -
                     settings.PERFHERDER_ALERTS_MAX_AGE)
    series = PerformanceDatum.objects.filter(signature=signature).filter(
        push_timestamp__gte=max_alert_age).order_by('push_timestamp')
    existing_alerts = PerformanceAlert.objects.filter(
        series_signature=signature).select_related(
            'summary').order_by('-summary__result_set_id')[:1]
    if existing_alerts:
        series = series.filter(
            result_set_id__gt=existing_alerts[0].summary.result_set_id)

    data = [Datum(int(time.mktime(d.push_timestamp.timetuple())), d.value, testrun_id=d.result_set_id) for d in series]
    prev = None

    min_back_window = signature.min_back_window
    if min_back_window is None:
        min_back_window = settings.PERFHERDER_ALERTS_MIN_BACK_WINDOW
    max_back_window = signature.max_back_window
    if max_back_window is None:
        max_back_window = settings.PERFHERDER_ALERTS_MAX_BACK_WINDOW
    fore_window = signature.fore_window
    if fore_window is None:
        fore_window = settings.PERFHERDER_ALERTS_FORE_WINDOW
    alert_threshold = signature.alert_threshold
    if alert_threshold is None:
        alert_threshold = settings.PERFHERDER_REGRESSION_THRESHOLD

    analyzed_series = detect_changes(data, min_back_window=min_back_window,
                                     max_back_window=max_back_window,
                                     fore_window=fore_window)
    prev_testrun_id = None
    with transaction.atomic():
        for (prev, cur) in zip(analyzed_series, analyzed_series[1:]):
            # we can have the same testrun id in a sequence if there are
            # retriggers, so only set the prev_testrun_id if that isn't
            # the case
            if prev.testrun_id != cur.testrun_id:
                prev_testrun_id = prev.testrun_id

            if cur.state == 'regression':
                prev_value = cur.historical_stats['avg']
                new_value = cur.forward_stats['avg']
                alert_properties = get_alert_properties(
                    prev_value, new_value, signature.lower_is_better)

                if alert_properties.pct_change < alert_threshold:
                    # ignore regressions below the configured regression
                    # threshold
                    continue

                summary, _ = PerformanceAlertSummary.objects.get_or_create(
                    repository=signature.repository,
                    framework=signature.framework,
                    result_set_id=cur.testrun_id,
                    prev_result_set_id=prev_testrun_id,
                    defaults={
                        'manually_created': False,
                        'last_updated': datetime.datetime.utcfromtimestamp(
                            cur.push_timestamp)
                    })

                # django/mysql doesn't understand "inf", so just use some
                # arbitrarily high value for that case
                t_value = cur.t
                if t_value == float('inf'):
                    t_value = 1000

                PerformanceAlert.objects.update_or_create(
                    summary=summary,
                    series_signature=signature,
                    defaults={
                        'is_regression': alert_properties.is_regression,
                        'amount_pct': alert_properties.pct_change,
                        'amount_abs': alert_properties.delta,
                        'prev_value': prev_value,
                        'new_value': new_value,
                        't_value': t_value
                    })
