import datetime
import logging
import time
from collections import namedtuple
from itertools import zip_longest
from typing import (List,
                    Tuple)

from django.conf import settings
from django.db import transaction
from django.db.models.query import QuerySet

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceSignature)
from treeherder.perfalert.perfalert import (RevisionDatum,
                                            detect_changes)


def get_alert_properties(prev_value, new_value, lower_is_better):
    AlertProperties = namedtuple('AlertProperties',
                                 'pct_change delta is_regression prev_value new_value')
    if prev_value != 0:
        pct_change = (100.0 * abs(new_value -
                                  prev_value) /
                      float(prev_value))
    else:
        pct_change = 0.0

    delta = (new_value - prev_value)

    is_regression = ((delta > 0 and lower_is_better) or
                     (delta < 0 and not lower_is_better))

    return AlertProperties(pct_change, delta, is_regression, prev_value, new_value)


def generate_new_alerts_in_series(signature):
    # get series data starting from either:
    # (1) the last alert, if there is one
    # (2) the alerts max age
    # (use whichever is newer)
    max_alert_age = (datetime.datetime.now() -
                     settings.PERFHERDER_ALERTS_MAX_AGE)
    series = PerformanceDatum.objects.filter(signature=signature).filter(
        push_timestamp__gte=max_alert_age).order_by('push_timestamp')
    latest_alert_timestamp = PerformanceAlert.objects.filter(
        series_signature=signature).select_related(
        'summary__push__time').order_by(
        '-summary__push__time').values_list(
        'summary__push__time', flat=True)[:1]
    if latest_alert_timestamp:
        series = series.filter(
            push_timestamp__gt=latest_alert_timestamp[0])

    revision_data = {}
    for d in series:
        if not revision_data.get(d.push_id):
            revision_data[d.push_id] = RevisionDatum(
                int(time.mktime(d.push_timestamp.timetuple())),
                d.push_id, [])
        revision_data[d.push_id].values.append(d.value)

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

    analyzed_series = detect_changes(revision_data.values(),
                                     min_back_window=min_back_window,
                                     max_back_window=max_back_window,
                                     fore_window=fore_window)

    with transaction.atomic():
        for (prev, cur) in zip(analyzed_series, analyzed_series[1:]):
            if cur.change_detected:
                prev_value = cur.historical_stats['avg']
                new_value = cur.forward_stats['avg']
                alert_properties = get_alert_properties(
                    prev_value, new_value, signature.lower_is_better)

                # ignore regressions below the configured regression
                # threshold
                if ((signature.alert_change_type is None or
                     signature.alert_change_type == PerformanceSignature.ALERT_PCT) and
                    alert_properties.pct_change < alert_threshold) or \
                        (signature.alert_change_type == PerformanceSignature.ALERT_ABS and
                         alert_properties.delta < alert_threshold):
                    continue

                summary, _ = PerformanceAlertSummary.objects.get_or_create(
                    repository=signature.repository,
                    framework=signature.framework,
                    push_id=cur.push_id,
                    prev_push_id=prev.push_id,
                    defaults={
                        'manually_created': False,
                        'created': datetime.datetime.utcfromtimestamp(
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


class AlertsPicker:
    '''
    Class encapsulating the algorithm used for selecting the most relevant alerts from a tuple of alerts.
    For this algorithm, regressions are considered the most important, followed by improvements.
    '''

    def __init__(self, max_alerts: int, max_improvements: int, platforms_of_interest: Tuple[str]):
        '''
        :param max_alerts: the maximum number of selected alerts
        :param max_improvements: max when handling only improvements
        :param platforms_of_interest: platforms in decreasing order of importance
              For selected platforms use the following names:
                Windows 10:  'windows10'
                Windows 7: 'windows7'
                Linux: 'linux'
                OS X: 'osx'
                Android: 'android'
            Note:
                too specific names can trigger a mismatch with database data; the effect will be the alert skipping
                too less specific will alter the correct order of alerts
        '''
        if max_alerts <= 0 or max_improvements <= 0:
            raise ValueError('Use positive values.')
        if len(platforms_of_interest) == 0:
            raise ValueError('Provide at least one platform name.')

        self.max_alerts = max_alerts
        self.max_improvements = max_improvements
        self.ordered_platforms_of_interest = platforms_of_interest

    def extract_important_alerts(self, alerts: Tuple[PerformanceAlert]):
        if any(not isinstance(alert, PerformanceAlert) for alert in alerts):
            raise ValueError('Provided parameter does not contain only PerformanceAlert objects.')
        relevant_alerts = self._extract_by_relevant_platforms(alerts)
        sorted_alerts = self._multi_criterion_sort(relevant_alerts)
        return self._ensure_alerts_variety(sorted_alerts)

    def _ensure_alerts_variety(self, sorted_alerts: List[PerformanceAlert]):
        '''
        The alerts container must be sorted before being passed to this function.
        The returned list must contain regressions and (if present) improvements.
        '''
        regressions_only = all(alert.is_regression for alert in sorted_alerts)
        improvements_only = all(not alert.is_regression for alert in sorted_alerts)

        if regressions_only or improvements_only:
            resulted_alerts_list = self._ensure_platform_variety(sorted_alerts)
        else:  # mixed alert types
            regressions = [alert for alert in sorted_alerts if alert.is_regression]
            improvements = [alert for alert in sorted_alerts if not alert.is_regression]

            if len(regressions) > 1:
                regressions = self._ensure_platform_variety(regressions)
                regressions[-1] = improvements[0]
            regressions.append(improvements[0])
            resulted_alerts_list = regressions

        return resulted_alerts_list[
               :self.max_improvements if improvements_only else self.max_alerts
               ]

    def _ensure_platform_variety(self, sorted_all_alerts: List[PerformanceAlert]):
        '''
        Note: Ensure that the sorted_all_alerts container has only
        platforms of interest (example: 'windows10', 'windows7', 'linux', 'osx', 'android').
        Please filter sorted_all_alerts list with filter_alerts(alerts) before calling this function.
        :param sorted_all_alerts: alerts sorted by platform name
        '''
        platform_grouped_alerts = []
        for platform in self.ordered_platforms_of_interest:
            specific_platform_alerts = [
                alert for alert in sorted_all_alerts
                if platform in alert.series_signature.platform.platform
            ]
            if len(specific_platform_alerts):
                platform_grouped_alerts.append(specific_platform_alerts)

        platform_picked = []
        for alert_group in zip_longest(*platform_grouped_alerts):
            platform_picked.extend(alert_group)
        platform_picked = [alert for alert in platform_picked if alert is not None]
        return platform_picked

    def _os_relevance(self, alert_platform: str):
        '''
        One of the sorting criteria.
        :param alert_platform: the name of the current alert's platform
        :return: int value of platform's relevance
        '''
        for platform_of_interest in self.ordered_platforms_of_interest:
            if alert_platform.startswith(platform_of_interest):
                return len(self.ordered_platforms_of_interest) - self.ordered_platforms_of_interest.index(
                    platform_of_interest)
        raise ValueError('Unknown platform.')

    def _has_relevant_platform(self, alert: PerformanceAlert):
        '''
        Filter criteria based on platform name.
        '''
        alert_platform_name = alert.series_signature.platform.platform
        return any(alert_platform_name.startswith(platform_of_interest)
                   for platform_of_interest in self.ordered_platforms_of_interest)

    def _extract_by_relevant_platforms(self, alerts):
        return list(filter(self._has_relevant_platform, alerts))

    def _multi_criterion_sort(self, relevant_alerts):
        sorted_alerts = sorted(
            relevant_alerts,
            # sort criteria
            key=lambda alert: (
                alert.is_regression,
                self._os_relevance(alert.series_signature.platform.platform),
                alert.amount_pct  # magnitude
            ),
            reverse=True
        )
        return sorted_alerts


class IdentifyingRetriggerables:
    def __init__(self, range_width: int, time_interval: datetime.timedelta, logger=None):
        if range_width < 1:
            raise ValueError('Cannot set range width less than 1')
        if range_width % 2 == 0:
            raise ValueError('Must provide odd range width')
        if not isinstance(time_interval, datetime.timedelta):
            raise TypeError('Must provide time interval as timedelta')

        self._range_width = range_width
        self._time_interval = time_interval
        self.log = logger or logging.getLogger(self.__call__.__name__)

    def __call__(self, alert: PerformanceAlert) -> List[dict]:
        """
        Main method
        """
        annotated_data_points = self._fetch_suspect_data_points(alert)  # in time_interval around alert
        flattened_data_points = self._one_data_point_per_push(annotated_data_points)

        try:
            alert_index = self._find_push_id_index(alert.summary.push_id, flattened_data_points)
        except LookupError as ex:
            raise RuntimeError("Unexpected lookup failure") from ex

        retrigger_window = self.__compute_window_slices(alert_index)
        data_points_to_retrigger = flattened_data_points[retrigger_window]

        self._glance_over_retrigger_range(data_points_to_retrigger)

        return data_points_to_retrigger

    def min_timestamp(self, alert_push_time: datetime.datetime) -> datetime.datetime:
        return alert_push_time - self._time_interval

    def max_timestamp(self, alert_push_time: datetime.datetime) -> datetime.datetime:
        return alert_push_time + self._time_interval

    def _fetch_suspect_data_points(self, alert: PerformanceAlert) -> QuerySet:
        startday = self.min_timestamp(alert.summary.push.time)
        endday = self.max_timestamp(alert.summary.push.time)

        data = (PerformanceDatum.objects.select_related('push')
                .filter(repository_id=alert.series_signature.repository_id,  # leverage compound index
                        signature_id=alert.series_signature_id,
                        push_timestamp__gt=startday,
                        push_timestamp__lt=endday,
                        ))

        annotated_data_points = (data
                                 # JSONs are more self explanatory
                                 # with perf_datum_id instead of id
                                 .extra(select={'perf_datum_id': 'performance_datum.id'})
                                 .values('value', 'job_id', 'perf_datum_id', 'push_id', 'push_timestamp',
                                         'push__revision')
                                 .order_by('push_timestamp'))
        return annotated_data_points

    def _one_data_point_per_push(self, annotated_data_points: QuerySet) -> List[dict]:
        seen_push_ids = set()
        seen_add = seen_push_ids.add
        return [data_point
                for data_point in annotated_data_points
                if not (data_point['push_id'] in seen_push_ids or seen_add(data_point['push_id']))]

    def _find_push_id_index(self, push_id: int, flattened_data_points: List[dict]) -> int:
        for index, data_point in enumerate(flattened_data_points):
            if data_point['push_id'] == push_id:
                return index
        raise LookupError(f'Could not find push id {push_id}')

    def __compute_window_slices(self, center_index: int) -> slice:
        side = self._range_width // 2

        left_margin = max(center_index - side, 0)  # cannot have negative start slice
        right_margin = center_index + side + 1

        return slice(left_margin, right_margin)

    def _glance_over_retrigger_range(self, data_points_to_retrigger: List[dict]):
        retrigger_range = len(data_points_to_retrigger)
        if retrigger_range < self._range_width:
            self.log.warning('Found small backfill range (of size {} instead of {})'
                             .format(retrigger_range, self._range_width))
