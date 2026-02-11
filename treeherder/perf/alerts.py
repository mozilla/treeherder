import logging
import time
from collections import namedtuple
from datetime import datetime

import moz_measure_noise
import numpy as np
from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Subquery

from treeherder.perf.email import AlertNotificationWriter
from treeherder.perf.methods import StudentTMagDetector
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceDatum,
    PerformanceDatumReplicate,
)
from treeherder.perfalert.perfalert import RevisionDatum
from treeherder.services import taskcluster

logger = logging.getLogger(__name__)


def define_methods():
    # Scaffolding to include more methods later on
    studenttmag = StudentTMagDetector.StudentTMagDetector(
        min_back_window=12,
        max_back_window=24,
        fore_window=12,
        alert_threshold=2.0,
        alpha_threshold=7,
        mag_check=True,
        above_threshold_is_anomaly=True,
    )
    methods = {"studenttmag": studenttmag}
    return methods


def create_alerting(signature, method, analyzed_series):
    for prev, cur in zip(analyzed_series, analyzed_series[1:]):
        if cur.change_detected:
            prev_value = cur.historical_stats["avg"]
            new_value = cur.forward_stats["avg"]

            alert_properties = method.get_alert_properties(
                prev_value, new_value, signature.lower_is_better
            )
            noise_profile = "N/A"
            try:
                noise_data = []
                for point in analyzed_series:
                    if point == cur:
                        break
                    noise_data.append(geomean(point.values))
                noise_profile, _ = moz_measure_noise.deviance(noise_data)

                if not isinstance(noise_profile, str):
                    raise Exception(
                        f"Expecting a string as a noise profile, got: {type(noise_profile)}"
                    )
            except Exception:
                pass

            summary, _ = PerformanceAlertSummary.objects.get_or_create(
                repository=signature.repository,
                framework=signature.framework,
                push_id=cur.push_id,
                prev_push_id=prev.push_id,
                sheriffed=not signature.monitor,
                defaults={
                    "manually_created": False,
                    "created": datetime.utcfromtimestamp(cur.push_timestamp),
                },
            )

            confidence = cur.t
            if confidence == float("inf"):
                confidence = 1000

            alert, _ = PerformanceAlert.objects.update_or_create(
                summary=summary,
                series_signature=signature,
                sheriffed=not signature.monitor,
                detection_method=method.name,
                defaults={
                    "noise_profile": noise_profile,
                    "is_regression": alert_properties.is_regression,
                    "amount_pct": alert_properties.pct_change,
                    "amount_abs": alert_properties.delta,
                    "prev_value": prev_value,
                    "new_value": new_value,
                    "t_value": confidence,
                },
            )
            # Email notifications getting disabled to not bother Sheriffs while doing testing
            if signature.alert_notify_emails:
                send_alert_emails(signature.alert_notify_emails.split(), alert, summary)


def send_alert_emails(emails, alert, alert_summary):
    notify_client = taskcluster.notify_client_factory()

    for email in emails:
        logger.info(f"Sending alert email to {email}")
        notification_writer = AlertNotificationWriter()
        email = notification_writer.prepare_new_email(email, alert, alert_summary)
        notify_client.email(email)


def geomean(iterable):
    # Returns a geomean of a list of values.
    a = np.array(iterable)
    return a.prod() ** (1.0 / len(a))


def get_alert_properties(prev_value, new_value, lower_is_better):
    AlertProperties = namedtuple(
        "AlertProperties", "pct_change delta is_regression prev_value new_value"
    )
    if prev_value != 0:
        pct_change = 100.0 * abs(new_value - prev_value) / float(prev_value)
    else:
        pct_change = 0.0

    delta = new_value - prev_value

    is_regression = (delta > 0 and lower_is_better) or (delta < 0 and not lower_is_better)

    return AlertProperties(pct_change, delta, is_regression, prev_value, new_value)


def generate_new_alerts_in_series(signature):
    # get series data starting from either:
    # (1) the last alert, if there is one
    # (2) the alerts max age
    # (use whichever is newer)
    max_alert_age = alert_after_ts = datetime.now() - settings.PERFHERDER_ALERTS_MAX_AGE
    series = PerformanceDatum.objects.filter(signature=signature, push_timestamp__gte=max_alert_age)
    latest_alert_timestamp = (
        PerformanceAlert.objects.filter(series_signature=signature)
        .select_related("summary__push__time")
        .order_by("-summary__push__time")
        .values_list("summary__push__time", flat=True)[:1]
    )
    if latest_alert_timestamp:
        latest_ts = latest_alert_timestamp[0]
        series = series.filter(push_timestamp__gt=latest_ts)
        if latest_ts > alert_after_ts:
            alert_after_ts = latest_ts

    datum_with_replicates = (
        PerformanceDatum.objects.filter(
            signature=signature,
            repository=signature.repository,
            push_timestamp__gte=alert_after_ts,
        )
        .annotate(
            has_replicate=Exists(
                PerformanceDatumReplicate.objects.filter(performance_datum_id=OuterRef("pk"))
            )
        )
        .filter(has_replicate=True)
    )
    replicates = PerformanceDatumReplicate.objects.filter(
        performance_datum_id__in=Subquery(datum_with_replicates.values("id"))
    ).values_list("performance_datum_id", "value")
    replicates_map: dict[int, list[float]] = {}
    for datum_id, value in replicates:
        replicates_map.setdefault(datum_id, []).append(value)

    revision_data = {}
    for d in series:
        if not revision_data.get(d.push_id):
            revision_data[d.push_id] = RevisionDatum(
                int(time.mktime(d.push_timestamp.timetuple())), d.push_id, [], []
            )
        revision_data[d.push_id].values.append(d.value)
        revision_data[d.push_id].replicates.extend(replicates_map.get(d.id, []))

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

    data = list(revision_data.values())
    methods = define_methods()
    student_t_mag_method = methods["studenttmag"]
    analyzed_series = student_t_mag_method.detect_changes(data, signature)

    with transaction.atomic():
        create_alerting(signature, student_t_mag_method, analyzed_series)
