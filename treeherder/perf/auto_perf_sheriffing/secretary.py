import logging
import time
from datetime import datetime, timedelta
from typing import Any

import simplejson as json
from django.conf import settings as django_settings

from treeherder.perf.auto_perf_sheriffing.outcome_checker import (
    OutcomeChecker,
    OutcomeStatus,
)
from treeherder.perf.models import (
    BackfillRecord,
    BackfillReport,
    PerformanceAlert,
    PerformanceDatum,
    PerformanceSettings,
    Push,
)
from treeherder.perfalert.perfalert import RevisionDatum, detect_changes
from treeherder.utils import default_serializer

logger = logging.getLogger(__name__)


# TODO: update the backfill status using data (bug 1626548)
# TODO: consider making this a singleton (bug 1639112)
class Secretary:
    """
    * marks which records can be backfilled
    * provides & maintains backfill limits
    * notes outcome of backfills (successful/unsuccessful)
    """

    def __init__(
        self, outcome_checker: OutcomeChecker = None, supported_platforms: list[str] = None
    ):
        self.outcome_checker = outcome_checker or OutcomeChecker()
        self.supported_platforms = supported_platforms or django_settings.SUPPORTED_PLATFORMS

    @classmethod
    def validate_settings(cls):
        sherlock_settings, created = PerformanceSettings.objects.get_or_create(
            # TODO: rename perf_sheriff_bot settings name to sherlock
            name="perf_sheriff_bot",
            defaults={"settings": cls._get_default_settings()},
        )

        if created:
            logger.info(
                "Performance settings for perf_sheriff_bot not found. Creating with defaults."
            )
            return

        # reset limits if the settings expired
        settings = json.loads(sherlock_settings.settings)
        logger.info(f"Sherlock settings: {settings}.")
        if cls.are_expired(settings):
            logger.info(f"Settings are expired. Expired settings: {settings}.")

            sherlock_settings.settings = cls._get_default_settings()
            sherlock_settings.save()

    @classmethod
    def mark_reports_for_backfill(cls):
        # get the backfill reports that are mature, but not frozen
        mature_date_limit = datetime.utcnow() - django_settings.TIME_TO_MATURE
        mature_reports = BackfillReport.objects.filter(
            frozen=False, last_updated__lte=mature_date_limit
        )

        logger.info(f"Sherlock: {mature_reports.count()} mature reports found.")

        # Only for logging alternative strategy for choosing maturity limit
        alternative_date_limit = datetime.utcnow() - timedelta(days=1)
        alternative_mature_reports = BackfillReport.objects.filter(
            frozen=False, created__lte=alternative_date_limit
        )
        logger.info(
            f"Sherlock: {alternative_mature_reports.count()} mature reports found with alternative strategy (not marking).",
        )

        for report in mature_reports:
            should_freeze = False
            logger.info(f"Sherlock: Marking report with id {report.summary.id} for backfill...")
            for record in report.records.all():
                if record.status == BackfillRecord.PRELIMINARY:
                    logger.info(
                        f"Sherlock: Marking record with id {record.alert.id} READY_FOR_PROCESSING..."
                    )
                    record.status = BackfillRecord.READY_FOR_PROCESSING
                    record.save()
                    should_freeze = True
            if should_freeze:
                report.frozen = True
                report.save()

    @classmethod
    def are_expired(cls, settings):
        last_reset_date = datetime.fromisoformat(settings["last_reset_date"])
        return datetime.utcnow() > last_reset_date + django_settings.RESET_BACKFILL_LIMITS

    def backfills_left(self, on_platform: str) -> int:
        self.__assert_platform_is_supported(on_platform)

        perf_sheriff_settings = PerformanceSettings.objects.get(name="perf_sheriff_bot")
        settings = json.loads(perf_sheriff_settings.settings)
        return settings["limits"][on_platform]

    def consume_backfills(self, on_platform: str, amount: int) -> int:
        self.__assert_platform_is_supported(on_platform)

        perf_sheriff_settings = PerformanceSettings.objects.get(name="perf_sheriff_bot")

        settings = json.loads(perf_sheriff_settings.settings)

        _backfills_left = left = settings["limits"][on_platform] - amount
        _backfills_left = left if left > 0 else 0

        settings["limits"][on_platform] = _backfills_left

        perf_sheriff_settings.set_settings(settings)
        perf_sheriff_settings.save()
        return _backfills_left

    def check_outcome(self):
        # fetch all records in backfilled state
        # we assume that BackfillRecord with BACKFILLED status were backfilled only for accepted platforms
        backfilled_records = BackfillRecord.objects.filter(status=BackfillRecord.BACKFILLED)

        for record in backfilled_records:
            # ensure each push in push range has at least one job of job type
            try:
                outcome = self.outcome_checker.check(record)
                # if outcome is IN_PROGRESS the BackfillRecord state will remain BACKFILLED to be checked again later
                if outcome == OutcomeStatus.SUCCESSFUL:
                    record.status = BackfillRecord.SUCCESSFUL
                elif outcome == OutcomeStatus.FAILED:
                    record.status = BackfillRecord.FAILED
                record.save()
                if outcome == OutcomeStatus.SUCCESSFUL or outcome == OutcomeStatus.FAILED:
                    self.verify_and_iterate(record)
            except ValueError as ex:
                logger.error(ex)

    def verify_and_iterate(self, record: BackfillRecord, max_iterations: int = 5):
        if record.iteration_count >= max_iterations:
            logger.info(
                f"Record {record.alert.id} reached max iterations ({max_iterations}), stopping verification."
            )
            return

        if record.last_detected_push_id is None:
            logger.warning(
                f"Record {record.alert.id}: last_detected_push_id is None; "
                f"skipping iteration (legacy record, no culprit push to compare)."
            )
            return

        try:
            detected_push_id, detected_t_value, candidates = self.re_run_detect_changes(record)

            if detected_push_id is None:
                logger.warning(
                    f"Record {record.alert.id}: No change detected in verification, stopping iteration."
                )
                return

            try:
                detected_push = Push.objects.get(id=detected_push_id)
            except Push.DoesNotExist as ex:
                logger.warning(
                    f"Record {record.alert.id}: Could not find push for comparison: {ex}"
                )
                record.status = BackfillRecord.VERIFICATION_FAILED
                record.save()
                return

            log_entry = {
                "iteration": record.iteration_count,
                "detected_push_id": detected_push_id,
                "detected_t_value": detected_t_value,
                "candidates": candidates,
                "timestamp": datetime.utcnow().isoformat(),
                "previous_push_id": record.last_detected_push_id,
                "detected_push_gap_size": self._calculate_gap_size(record, detected_push),
            }

            if detected_push_id == record.last_detected_push_id:
                if log_entry["detected_push_gap_size"] > 0:
                    previous_logs = record.get_backfill_logs()
                    previous_gap_size = (
                        previous_logs[-1].get("detected_push_gap_size") if previous_logs else None
                    )
                    current_gap_size = log_entry["detected_push_gap_size"]
                    if previous_gap_size is not None and current_gap_size == previous_gap_size:
                        log_entry["status"] = "stabilized_gap_stuck"
                        log_entry["notes"] = (
                            f"Gap before {detected_push_id} did not shrink "
                            f"(was {previous_gap_size}, still {current_gap_size}); "
                            f"pushes likely lack target job type, stopping."
                        )
                        record.append_to_backfill_logs(log_entry)
                        record.save()
                        logger.info(
                            f"Backfill Record {record.alert.id}: Gap stuck at size {current_gap_size} "
                            f"(was {previous_gap_size}), pushes likely unsupported — stopping iteration."
                        )
                        return

                    log_entry["status"] = "stabilized_with_gap"
                    log_entry["notes"] = (
                        f"Detection stabilized at {detected_push_id} but gap remains before it, re-triggering"
                    )
                    record.last_detected_push_id = detected_push_id
                    record.append_to_backfill_logs(log_entry)
                    record.status = BackfillRecord.READY_FOR_PROCESSING
                    record.save()
                    logger.info(
                        f"Backfill Record {record.alert.id}: Detection stabilized at {detected_push_id} "
                        f"but gap remains, iteration {record.iteration_count}/{max_iterations}, "
                        f"triggering next backfill."
                    )
                else:
                    log_entry["status"] = "stabilized"
                    log_entry["notes"] = "Detected push same as previous, culprit stabilized"
                    record.append_to_backfill_logs(log_entry)
                    record.save()
                    logger.info(
                        f"Backfill Record {record.alert.id}: Detected push {detected_push_id} stabilized, "
                        f"stopping iteration."
                    )
                return

            try:
                previous_push = Push.objects.get(id=record.last_detected_push_id)
            except Push.DoesNotExist as ex:
                logger.warning(
                    f"Record {record.alert.id}: Could not find push for comparison: {ex}"
                )
                record.status = BackfillRecord.VERIFICATION_FAILED
                record.save()
                return

            if detected_push.time < previous_push.time:
                direction = "left"
            else:
                direction = "right"

            log_entry["status"] = direction
            log_entry["notes"] = (
                f"Detected push moved {direction} (from {record.last_detected_push_id} to {detected_push_id})"
            )
            logger.info(
                f"Backfill Record {record.alert.id}: Detected push moved {direction} "
                f"from {record.last_detected_push_id} to {detected_push_id}, "
                f"iteration {record.iteration_count}/{max_iterations}, triggering next backfill."
            )

            record.last_detected_push_id = detected_push_id
            record.append_to_backfill_logs(log_entry)
            record.status = BackfillRecord.READY_FOR_PROCESSING
            record.save()

        except Exception as ex:
            logger.error(
                f"Record {record.alert.id}: Error during verification/iteration: {ex}",
                exc_info=True,
            )
            record.status = BackfillRecord.VERIFICATION_FAILED
            record.save()

    def __assert_platform_is_supported(self, on_platform: str):
        if on_platform not in self.supported_platforms:
            raise ValueError(f"Unsupported platform: {on_platform}.")

    @classmethod
    def _get_default_settings(cls, as_json=True):
        default_settings = {
            "limits": django_settings.MAX_BACKFILLS_PER_PLATFORM,
            "last_reset_date": datetime.utcnow(),
        }

        return (
            json.dumps(default_settings, default=default_serializer)
            if as_json
            else default_settings
        )

    def re_run_detect_changes(
        self, record: BackfillRecord
    ) -> tuple[int | None, float | None, list[dict[str, Any]]]:
        """
        Re-run detect_changes on the alert's signature and return the detected push_id.
        Returns None if no change is detected.
        Returns:
            tuple: (detected_push_id, detected_t_value, candidates)
        """
        signature = record.alert.series_signature
        repository = record.repository
        min_back_window = signature.min_back_window
        if min_back_window is None:
            min_back_window = django_settings.PERFHERDER_ALERTS_MIN_BACK_WINDOW
        max_back_window = signature.max_back_window
        if max_back_window is None:
            max_back_window = django_settings.PERFHERDER_ALERTS_MAX_BACK_WINDOW
        fore_window = signature.fore_window
        if fore_window is None:
            fore_window = django_settings.PERFHERDER_ALERTS_FORE_WINDOW

        try:
            last_detected_push = Push.objects.get(
                id=record.last_detected_push_id, repository=repository
            )
        except Push.DoesNotExist as ex:
            logger.warning(f"Record {record.alert.id}: Could not find last detected push: {ex}")
            return None, None, []

        start_time = last_detected_push.time - django_settings.PERFHERDER_ALERTS_MAX_AGE
        prev_alert = (
            PerformanceAlert.objects.filter(
                series_signature=signature,
                summary__push__time__gte=start_time,
                summary__push__time__lt=last_detected_push.time,
            )
            .order_by("-summary__push__time")
            .first()
        )
        if prev_alert:
            start_time = prev_alert.summary.push.time
        fore_pushes = list(
            PerformanceDatum.objects.filter(
                signature=signature,
                repository=repository,
                push_timestamp__gte=last_detected_push.time,
            ).order_by("push_timestamp")[:fore_window]
        )
        if fore_pushes:
            end_time = fore_pushes[-1].push_timestamp
        else:
            end_time = last_detected_push.time + timedelta(days=7)
        series = (
            PerformanceDatum.objects.filter(
                signature=signature,
                repository=repository,
                push_timestamp__gte=start_time,
                push_timestamp__lte=end_time,
            )
            .values_list("push_id", "push_timestamp", "value")
            .order_by("push_timestamp")
        )

        revision_data = {}
        for push_id, push_timestamp, value in series:
            if not revision_data.get(push_id):
                revision_data[push_id] = RevisionDatum(
                    int(time.mktime(push_timestamp.timetuple())), push_id, [], []
                )
            revision_data[push_id].values.append(value)
        if not revision_data:
            logger.warning(
                f"No performance data found for signature {signature.id} in verification range."
            )
            return None, None, []

        data = list(revision_data.values())
        analyzed_series = detect_changes(
            data,
            min_back_window=min_back_window,
            max_back_window=max_back_window,
            fore_window=fore_window,
        )

        candidates: list[dict[str, Any]] = []
        for prev, cur in zip(analyzed_series, analyzed_series[1:]):
            if cur.change_detected:
                candidates.append(
                    {
                        "push_id": int(cur.push_id),
                        "t_value": float(cur.t),
                        "push_timestamp": int(cur.push_timestamp),
                    }
                )
        if not candidates:
            return None, None, []

        # Pick the earliest push from the detected candidates
        culprit = min(candidates, key=lambda c: c["push_timestamp"])
        return culprit["push_id"], culprit["t_value"], candidates

    def _calculate_gap_size(self, record: BackfillRecord, target_push: Push) -> int:
        """
        Count consecutive pushes without performance data immediately before `target_push`.
        """
        signature = record.alert.series_signature
        repository = record.repository
        pushes_before = list(
            Push.objects.filter(repository=repository, time__lt=target_push.time).order_by("-time")[
                :100
            ]
        )
        if not pushes_before:
            return 0

        datum_push_ids = set(
            PerformanceDatum.objects.filter(
                repository=repository,
                signature=signature,
                push_id__in=[p.id for p in pushes_before],
            ).values_list("push_id", flat=True)
        )

        gap_count = 0
        for p in pushes_before:
            if p.id not in datum_push_ids:
                gap_count += 1
            else:
                break
        return gap_count
