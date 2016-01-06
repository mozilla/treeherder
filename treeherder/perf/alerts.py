import datetime
import time

from django.conf import settings
from django.db import transaction

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum)
from treeherder.perfalert import Analyzer


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

    a = Analyzer()
    for datum in series:
        timestamp = int(time.mktime(
            datum.push_timestamp.timetuple()))
        a.add_data(timestamp, datum.value,
                   testrun_id=datum.result_set_id)
    prev = None
    analyzed_series = a.analyze_t()
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
                    # ignore regressions below the configured regression
                    # threshold
                    continue

                summary, _ = PerformanceAlertSummary.objects.get_or_create(
                    repository=signature.repository,
                    result_set_id=cur.testrun_id,
                    prev_result_set_id=prev_testrun_id,
                    defaults={
                        'last_updated': datetime.datetime.fromtimestamp(
                            cur.push_timestamp)
                    })
                # django/mysql doesn't understand "inf", so just use some
                # arbitrarily high value for that case
                t_value = cur.t
                if t_value == float('inf'):
                    t_value = 1000

                a = PerformanceAlert.objects.create(
                    summary=summary,
                    series_signature=signature,
                    is_regression=is_regression,
                    amount_pct=pct_change,
                    amount_abs=delta,
                    prev_value=prev_value,
                    new_value=new_value,
                    t_value=t_value)
                a.save()
