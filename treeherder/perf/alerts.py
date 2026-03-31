import logging
import time
from collections import namedtuple
from datetime import datetime

import moz_measure_noise
import newrelic.agent
import numpy as np
from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Subquery

from treeherder.perf.email import AlertNotificationWriter
from treeherder.perf.methods.CramerVonMisesDetector import CramerVonMisesDetector
from treeherder.perf.methods.KolmogorovSmirnovDetector import KolmogorovSmirnovDetector
from treeherder.perf.methods.MannWhitneyUDetector import MannWhitneyUDetector
from treeherder.perf.methods.StudentDetector import StudentDetector
from treeherder.perf.methods.WelchDetector import WelchDetector
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceAlertSummaryTesting,
    PerformanceAlertTesting,
    PerformanceDatum,
    PerformanceDatumReplicate,
    PerformanceSignature,
    PerformanceTelemetrySignature,
    RevisionDatumTest,
)
from treeherder.perfalert.perfalert import RevisionDatum, detect_changes
from treeherder.services import taskcluster

logger = logging.getLogger(__name__)

# Selects which voting algorithm is used to combine detections across methods. The avaiable strategies are equal and priority voting.
VOTING_STRATEGY = "equal"
# Sets how many methods must agree before an alert is raised.
MIN_METHOD_AGREEMENT = 3
# Controls how far apart two detections can be while still being counted as the same change.
DETECTION_INDEX_TOLERANCE = 1
# Toggles whether raw repeated measurements are passed to the detectors instead of aggregated values.
REPLICATES = False


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

    data = revision_data.values()
    analyzed_series = detect_changes(
        data,
        min_back_window=min_back_window,
        max_back_window=max_back_window,
        fore_window=fore_window,
    )

    with transaction.atomic():
        for prev, cur in zip(analyzed_series, analyzed_series[1:]):
            if cur.change_detected:
                prev_value = cur.historical_stats["avg"]
                new_value = cur.forward_stats["avg"]
                alert_properties = get_alert_properties(
                    prev_value, new_value, signature.lower_is_better
                )

                noise_profile = "N/A"
                try:
                    # Gather all data up to the current data point that
                    # shows the regression and obtain a noise profile on it.
                    # This helps us to ignore this alert and others in the
                    # calculation that could influence the profile.
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
                    # Fail without breaking the alert computation
                    newrelic.agent.notice_error()
                    logger.error("Failed to obtain a noise profile.")

                # ignore regressions below the configured regression
                # threshold
                if (
                    (
                        signature.alert_change_type is None
                        or signature.alert_change_type == PerformanceSignature.ALERT_PCT
                    )
                    and alert_properties.pct_change < alert_threshold
                ) or (
                    signature.alert_change_type == PerformanceSignature.ALERT_ABS
                    and abs(alert_properties.delta) < alert_threshold
                ):
                    continue

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

                # django/mysql doesn't understand "inf", so just use some
                # arbitrarily high value for that case
                t_value = cur.t
                if t_value == float("inf"):
                    t_value = 1000

                alert, _ = PerformanceAlert.objects.update_or_create(
                    summary=summary,
                    series_signature=signature,
                    sheriffed=not signature.monitor,
                    defaults={
                        "noise_profile": noise_profile,
                        "is_regression": alert_properties.is_regression,
                        "amount_pct": alert_properties.pct_change,
                        "amount_abs": alert_properties.delta,
                        "prev_value": prev_value,
                        "new_value": new_value,
                        "t_value": t_value,
                    },
                )

                if signature.alert_notify_emails:
                    send_alert_emails(signature.alert_notify_emails.split(), alert, summary)


def build_cpd_methods():
    """
    Upon doing the initial hyper-parameter tuning of the methods (each individually), we experimented
    with multiple hyper parameters including the min/max back windows and the foreward window in order
    to have the best possible performance. For each method, we select the best-performing hyper-parameter
    configuration upoon evaluating the methods individually. However, upon incorporating those into the
    voting system, we need to select a set of hyper-parameter configuration that has a fixed forward and
    back windows across all methods. This is because having different windows values for different methods
    makes them fundamentally not evaluate the same set of data, which is inconsistent. Therefore, we
    choose to fix the back and forward windows values by using the existing values for the Student T Test
    and do the tuning of only the confidence and magnitude of check hyper parameters.
    """
    student = StudentDetector(
        name="student",
        min_back_window=12,
        max_back_window=24,
        fore_window=12,
        alert_threshold=1.0,
        confidence_threshold=5,
        mag_check=True,
        above_threshold_is_anomaly=True,
    )
    cvm = CramerVonMisesDetector(
        name="cvm",
        min_back_window=12,
        max_back_window=24,
        fore_window=12,
        alert_threshold=3.0,
        confidence_threshold=0.005,
        mag_check=True,
        above_threshold_is_anomaly=False,
    )
    ks = KolmogorovSmirnovDetector(
        name="ks",
        min_back_window=12,
        max_back_window=24,
        fore_window=12,
        alert_threshold=3.0,
        confidence_threshold=0.005,
        mag_check=True,
        above_threshold_is_anomaly=False,
    )
    welch = WelchDetector(
        name="welch",
        min_back_window=12,
        max_back_window=24,
        fore_window=12,
        alert_threshold=3.0,
        confidence_threshold=0.005,
        mag_check=True,
        above_threshold_is_anomaly=False,
    )
    """
    Levene is currently excluded from the voting ensemble because in practice we've observed it
    to be degrading the quality of the voting as it gives more false positives and false negatives
    compared to the other methods. This is reflected in the evaluation results we found earlier as
    the precision and recall values of this method is significantly lower than the other methods.
    We may consider re-adding it to the ensemble in the future if more tuning is done to improve
    its performance or if we want to increase the diversity of the methods in the ensemble, but
    for now we have decided to exclude it to maximize the overall quality of the voting ensemble.
    """
    """
    levene = LeveneDetector(
        name="levene",
        min_back_window=12,
        max_back_window=24,
        fore_window=12,
        alert_threshold=3.0,
        confidence_threshold=0.035,
        mag_check=True,
        above_threshold_is_anomaly=False,
    )
    """
    mwu = MannWhitneyUDetector(
        name="mwu",
        min_back_window=12,
        max_back_window=24,
        fore_window=12,
        alert_threshold=3.0,
        confidence_threshold=0.005,
        mag_check=True,
        above_threshold_is_anomaly=False,
    )
    methods = {
        "student": student,
        "cvm": cvm,
        "ks": ks,
        "welch": welch,
        "mwu": mwu,
    }
    return methods


def name_voting_strategy(
    voting_strategy,
    min_method_agreement,
    detection_index_tolerance,
    replicates_enabled,
):
    """
    Builds a string label encoding the active voting configuration, used to tag
    alerts with the strategy that produced them.
    """
    suffix = "replicates_enabled" if replicates_enabled else "replicates_not_enabled"

    voting_strategy_naming = (
        voting_strategy
        + "_voting_"
        + str(min_method_agreement)
        + "_min_method_agreement_"
        + str(detection_index_tolerance)
        + "_tolerance_"
        + suffix
    )

    return voting_strategy_naming


def detect_methods_changes(signature, data, methods, replicates_enabled=False):
    analyzed_series = data
    for method_impl in methods.values():
        analyzed_series = method_impl.detect_changes(analyzed_series, signature, replicates_enabled)
    return analyzed_series


def vote(
    signature,
    analyzed_series,
    voting_strategy="equal",
    min_method_agreement=3,
    detection_index_tolerance=1,
    detection_method_name=None,
):
    """
    Apply voting logic to determine which alerts to create based on multiple detection methods.
    Each voting strategy returns a list of (weighted_index, prev_index, methods_data) tuples and
    a detection method naming string. Alert creation is handled here to ensure exactly one
    alert is created per agreed-upon change point regardless of which voting strategy is used.
    """
    if voting_strategy == "equal":
        detections = equal_voting_strategy(
            analyzed_series=analyzed_series,
            min_method_agreement=min_method_agreement,
            detection_index_tolerance=detection_index_tolerance,
        )
    elif voting_strategy == "priority":
        detections = priority_voting_strategy(
            analyzed_series=analyzed_series,
            min_method_agreement=min_method_agreement,
            detection_index_tolerance=detection_index_tolerance,
        )
    else:
        raise ValueError(f"Unknown voting strategy: {voting_strategy}")

    for weighted_index, prev_index, methods_data in detections:
        cur = analyzed_series[weighted_index]
        prev = analyzed_series[prev_index]
        create_alert(
            signature,
            analyzed_series,
            prev,
            cur,
            weighted_index,
            methods_data,
            detection_method_name,
        )


def get_methods_detecting_at_index(analyzed_series, index, detection_index_tolerance=1):
    """
    Get detection data for all methods within detection tolerance margin of the given index.
    """
    all_methods = build_cpd_methods().keys()
    methods_data = {}

    # Check within the detection tolerance
    start_idx = max(0, index - detection_index_tolerance)
    end_idx = min(len(analyzed_series), index + detection_index_tolerance + 1)

    for i in range(start_idx, end_idx):
        datum = analyzed_series[i]
        for method_name in all_methods:
            if datum.change_detected.get(method_name, False):
                # Only record first detection for each method
                if method_name not in methods_data:
                    confidence_value = datum.confidence.get(method_name, None)

                    # Handle inf values
                    if confidence_value == float("inf"):
                        confidence_value = 1000

                    methods_data[method_name] = {
                        "push_id": datum.push_id,
                        "confidence": confidence_value,
                    }
    return methods_data


def get_weighted_average_push(analyzed_series, methods, start_idx, end_idx):
    """
    Get the index that is the weighted average of where methods detected changes.
    """
    # Track which indices each method detected at
    method_detections = {}  # {method_name: index}

    for i in range(start_idx, end_idx + 1):
        if i >= len(analyzed_series):
            break
        datum = analyzed_series[i]
        for method in methods:
            if datum.change_detected.get(method, False):
                # Only record first detection for each method in range
                if method not in method_detections:
                    method_detections[method] = i

    if not method_detections:
        return None, None

    # Calculate weighted average of detection indices
    total_index = sum(method_detections.values())
    num_methods = len(method_detections)
    weighted_avg_index = total_index // num_methods

    # Clamp to valid range
    weighted_avg_index = max(start_idx, min(end_idx, weighted_avg_index))
    weighted_avg_index = min(len(analyzed_series) - 1, weighted_avg_index)

    # Get previous index
    prev_index = max(0, weighted_avg_index - 1)

    return weighted_avg_index, prev_index


def priority_voting_strategy(analyzed_series, min_method_agreement=3, detection_index_tolerance=1):
    """
    Priority voting strategy where student method has voting priority.
    Returns a list of (weighted_index, prev_index, methods_data) tuples and a naming string.
    """
    if not analyzed_series or len(analyzed_series) < 2:
        return []

    detections = []
    # Track which indices we've already added detections for (to avoid duplicates
    # in both Phase 1 and the fallback equal voting strategy)
    alerted_indices = set()

    # Phase 1: Student detections (no detection tolerance)
    for i in range(1, len(analyzed_series)):
        # This prevents duplicate alerts from being raised for the same underlying change event
        # since different detection methods may pinpoint it at slightly different indices.
        if any(
            abs(i - alerted_idx) <= detection_index_tolerance for alerted_idx in alerted_indices
        ):
            continue

        cur = analyzed_series[i]

        if cur.change_detected.get("student", False):
            prev_index = i - 1
            methods_data = get_methods_detecting_at_index(
                analyzed_series, i, detection_index_tolerance=detection_index_tolerance
            )

            detections.append((i, prev_index, methods_data))
            alerted_indices.add(i)

    # Phase 2: Fall back to equal voting strategy for indices not caught by Student
    # Student won't influence the vote here since change_detected["student"]
    # is False for all remaining candidates
    equal_detections = equal_voting_strategy(
        analyzed_series=analyzed_series,
        min_method_agreement=min_method_agreement,
        detection_index_tolerance=detection_index_tolerance,
        alerted_indices=alerted_indices,
    )
    detections.extend(equal_detections)

    return detections


def equal_voting_strategy(
    analyzed_series,
    min_method_agreement=3,
    detection_index_tolerance=1,
    alerted_indices=None,
):
    """
    Equal voting strategy where all methods have equal weight.
    Returns a list of (weighted_index, prev_index, methods_data) tuples and a naming string.
    """
    if not analyzed_series or len(analyzed_series) < 2:
        return []

    alerted_indices = alerted_indices if alerted_indices is not None else set()
    detections = []

    for i in range(1, len(analyzed_series)):
        # Skip if we've already created an alert near this index
        if any(
            abs(i - alerted_idx) <= detection_index_tolerance for alerted_idx in alerted_indices
        ):
            continue

        # Check how many methods detected a change within the detection tolerance
        methods_detecting_data = get_methods_detecting_at_index(
            analyzed_series, i, detection_index_tolerance
        )

        # Check if enough methods agree
        if len(methods_detecting_data) >= min_method_agreement:
            # Get weighted average index based on where each method detected
            start_idx = max(0, i - detection_index_tolerance)
            end_idx = min(len(analyzed_series) - 1, i + detection_index_tolerance)
            weighted_index, prev_index = get_weighted_average_push(
                analyzed_series, methods_detecting_data, start_idx, end_idx
            )

            if weighted_index is not None:
                detections.append((weighted_index, prev_index, methods_detecting_data))
                alerted_indices.add(weighted_index)

    return detections


def create_alert(
    signature,
    analyzed_series,
    prev,
    cur,
    alert_index,
    detected_changes,
    detection_method_naming,
):
    telemetry_sig, _ = PerformanceTelemetrySignature.objects.get_or_create(
        channel=PerformanceTelemetrySignature.NIGHTLY,
        probe="test_probe",
        probe_type=PerformanceTelemetrySignature.GLEAN,
        platform=signature.platform,
        application=signature.application,
    )

    all_methods = build_cpd_methods().keys()
    confidences = {}

    for method in all_methods:
        confidence_value = cur.confidence.get(method, None)
        if confidence_value == float("inf"):
            confidence_value = 1000
        if method in detected_changes:
            data = detected_changes[method]
            confidences[method] = {
                "push_id": data["push_id"],
                "confidence": confidence_value,
                "change_detected": True,
                "detection_push_confidence": data["confidence"],
            }
        else:
            confidences[method] = {
                "push_id": cur.push_id,
                "confidence": confidence_value,
                "change_detected": False,
                "detection_push_confidence": confidence_value,
            }

    # Get Student's confidence for t_value field
    student_confidence = confidences["student"]["confidence"] or None

    prev_value = cur.historical_stats["avg"]
    new_value = cur.forward_stats["avg"]

    alert_properties = get_alert_properties(prev_value, new_value, signature.lower_is_better)

    # Calculate noise profile
    noise_profile = "N/A"
    try:
        noise_data = []
        for idx, point in enumerate(analyzed_series):
            if idx >= alert_index:
                break
            noise_data.append(geomean(point.values))

        if noise_data:
            noise_profile, _ = moz_measure_noise.deviance(noise_data)

            if not isinstance(noise_profile, str):
                raise Exception(
                    f"Expecting a string as a noise profile, got: {type(noise_profile)}"
                )
    except Exception:
        # Fail without breaking the alert computation
        newrelic.agent.notice_error()
        logger.error("Failed to obtain a noise profile.")

    # Create or get alert summary using the weighted average push's IDs
    summary, created_new = PerformanceAlertSummaryTesting.objects.get_or_create(
        repository=signature.repository,
        framework=signature.framework,
        push_id=cur.push_id,
        prev_push_id=prev.push_id,
        defaults={
            "manually_created": False,
            "created": datetime.utcfromtimestamp(cur.push_timestamp),
            "sheriffed": not signature.monitor,
        },
    )

    if created_new:
        # Set custom timestamp after creation
        PerformanceAlertSummaryTesting.objects.filter(pk=summary.pk).update(
            created=datetime.utcfromtimestamp(cur.push_timestamp)
        )
        summary.refresh_from_db()

    # Create or update the alert
    alert, _ = PerformanceAlertTesting.objects.update_or_create(
        summary=summary,
        series_signature=signature,
        telemetry_series_signature=telemetry_sig,
        detection_method=detection_method_naming,
        defaults={
            "noise_profile": noise_profile,
            "is_regression": alert_properties.is_regression,
            "amount_pct": alert_properties.pct_change,
            "amount_abs": alert_properties.delta,
            "prev_value": prev_value,
            "new_value": new_value,
            "t_value": student_confidence,  # Student's confidence for backwards compatibility
            "confidences": confidences,
            "sheriffed": not signature.monitor,
            "prev_median": 0,
            "new_median": 0,
            "prev_p05": 0,
            "new_p05": 0,
            "prev_p95": 0,
            "new_p95": 0,
        },
    )

    # Note: Email notifications are disabled for testing as per original code
    if signature.alert_notify_emails:
        send_alert_emails(signature.alert_notify_emails.split(), alert, summary)


def generate_new_test_alerts_in_series(
    signature,
    voting_strategy=VOTING_STRATEGY,
    min_method_agreement=MIN_METHOD_AGREEMENT,
    detection_index_tolerance=DETECTION_INDEX_TOLERANCE,
    replicates_enabled=REPLICATES,
):
    detection_method_name = name_voting_strategy(
        voting_strategy,
        min_method_agreement,
        detection_index_tolerance,
        replicates_enabled,
    )
    # get series data starting from either:
    # (1) the last alert, if there is one
    # (2) the alerts max age
    # use whichever is newer
    with transaction.atomic():
        max_alert_age = alert_after_ts = datetime.now() - settings.PERFHERDER_ALERTS_MAX_AGE
        series = PerformanceDatum.objects.filter(
            signature=signature, push_timestamp__gte=max_alert_age
        )
        latest_alert_timestamp = (
            PerformanceAlertTesting.objects.filter(
                series_signature=signature, detection_method=detection_method_name
            )
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
                revision_data[d.push_id] = RevisionDatumTest(
                    int(time.mktime(d.push_timestamp.timetuple())), d.push_id, [], []
                )
            revision_data[d.push_id].values.append(d.value)
            revision_data[d.push_id].replicates.extend(replicates_map.get(d.id, []))

        data = list(revision_data.values())
        methods = build_cpd_methods()
        analyzed_series = detect_methods_changes(
            signature, data, methods, replicates_enabled=replicates_enabled
        )

        # Apply voting with configurable parameters
        # min_method_agreement: consensus threshold (absolute number: 3 means 3 methods must agree out of 6 total)
        # detection_index_tolerance: tolerance for matching detections (±2 indices)
        vote(
            signature,
            analyzed_series,
            voting_strategy=voting_strategy,
            min_method_agreement=min_method_agreement,
            detection_index_tolerance=detection_index_tolerance,
            detection_method_name=detection_method_name,
        )
