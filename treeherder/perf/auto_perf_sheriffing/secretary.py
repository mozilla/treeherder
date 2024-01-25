import logging
from datetime import datetime, timedelta
from typing import List

import simplejson as json
from django.conf import settings as django_settings

from treeherder.perf.auto_perf_sheriffing.outcome_checker import OutcomeChecker, OutcomeStatus
from treeherder.perf.models import BackfillRecord, BackfillReport, PerformanceSettings
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
        self, outcome_checker: OutcomeChecker = None, supported_platforms: List[str] = None
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
            except ValueError as ex:
                logger.error(ex)

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
