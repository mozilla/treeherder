from django.conf import settings
import datetime
import time

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum)
from treeherder.perfalert import Analyzer


def generate_new_alerts_in_series(signature):
    series = PerformanceDatum.objects.filter(
        signature=signature).order_by(
            'push_timestamp')
    existing_alerts = PerformanceAlert.objects.filter(
        series_signature=signature).order_by('-result_set_id')[:1]
    if existing_alerts:
        series = series.filter(
            result_set_id__gt=existing_alerts[0].result_set_id)

    a = Analyzer()
    for datum in series:
        timestamp = int(time.mktime(
            datum.push_timestamp.timetuple()))
        a.add_data(timestamp, datum.value,
                   testrun_id=datum.result_set_id)
    prev = None
    analyzed_series = a.analyze_t()
    for (prev, cur) in zip(analyzed_series, analyzed_series[1:]):
        if cur.state == 'regression':
            prev_value = cur.historical_stats['avg']
            new_value = cur.forward_stats['avg']
            if prev_value != 0:
                pct_change = (100.0 * abs(new_value -
                                          prev_value) /
                              float(prev_value))
            else:
                pct_change = 0.0
            delta = (new_value - prev_value)

            is_regression = ((delta > 0 and signature.lower_is_better) or
                             (delta < 0 and not signature.lower_is_better))

            if pct_change < settings.PERFHERDER_REGRESSION_THRESHOLD:
                # ignore regressions below a threshold of 1%
                continue

            summary, _ = PerformanceAlertSummary.objects.get_or_create(
                repository=signature.repository,
                result_set_id=cur.testrun_id,
                prev_result_set_id=prev.testrun_id,
                defaults={
                    'last_updated': datetime.datetime.fromtimestamp(
                        cur.push_timestamp)
                })

            # django/mysql doesn't understand "inf", so just use some
            # arbitrarily high value for that case
            t_value = cur.t
            if t_value == float('inf'):
                t_value = 1000

            alert = PerformanceAlert.objects.create(
                repository=signature.repository,
                result_set_id=cur.testrun_id,
                prev_result_set_id=prev.testrun_id,
                series_signature=signature,
                amount_pct=pct_change,
                amount_abs=delta,
                prev_value=prev_value,
                new_value=new_value,
                is_regression=is_regression,
                t_value=t_value)
            summary.generated_alerts.add(alert)
