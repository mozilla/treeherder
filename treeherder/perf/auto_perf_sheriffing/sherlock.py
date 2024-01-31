import logging
from datetime import datetime, timedelta
from json import JSONDecodeError
from logging import INFO, WARNING
from typing import List, Tuple

from django.conf import settings
from django.db.models import QuerySet
from taskcluster.helper import TaskclusterConfig

from treeherder.perf.auto_perf_sheriffing.backfill_reports import BackfillReportMaintainer
from treeherder.perf.auto_perf_sheriffing.backfill_tool import BackfillTool
from treeherder.perf.auto_perf_sheriffing.secretary import Secretary
from treeherder.perf.exceptions import CannotBackfill, MaxRuntimeExceeded
from treeherder.perf.models import BackfillRecord, BackfillReport, BackfillNotificationRecord

logger = logging.getLogger(__name__)

CLIENT_ID = settings.PERF_SHERIFF_BOT_CLIENT_ID
ACCESS_TOKEN = settings.PERF_SHERIFF_BOT_ACCESS_TOKEN


class Sherlock:
    """
    Robot variant of a performance sheriff (the main class)

    Automates backfilling of skipped perf jobs.
    """

    DEFAULT_MAX_RUNTIME = timedelta(minutes=50)

    def __init__(
        self,
        report_maintainer: BackfillReportMaintainer,
        backfill_tool: BackfillTool,
        secretary: Secretary,
        max_runtime: timedelta = None,
        supported_platforms: List[str] = None,
    ):
        self.report_maintainer = report_maintainer
        self.backfill_tool = backfill_tool
        self.secretary = secretary
        self._max_runtime = self.DEFAULT_MAX_RUNTIME if max_runtime is None else max_runtime

        self.supported_platforms = supported_platforms or settings.SUPPORTED_PLATFORMS
        self._wake_up_time = datetime.now()

    def sheriff(self, since: datetime, frameworks: List[str], repositories: List[str]):
        logger.info("Sherlock: Validating settings...")
        self.secretary.validate_settings()

        logger.info("Sherlock: Marking reports for backfill...")
        self.secretary.mark_reports_for_backfill()
        self.assert_can_run()

        # secretary checks the status of all backfilled jobs
        self.secretary.check_outcome()
        self.assert_can_run()

        # reporter tool should always run *(only handles preliminary records/reports)*
        logger.info("Sherlock: Reporter tool is creating/maintaining  reports...")
        self._report(since, frameworks, repositories)
        self.assert_can_run()

        # backfill tool follows
        logger.info("Sherlock: Starting to backfill...")
        self._backfill(frameworks, repositories)
        self.assert_can_run()

    def runtime_exceeded(self) -> bool:
        elapsed_runtime = datetime.now() - self._wake_up_time
        return self._max_runtime <= elapsed_runtime

    def assert_can_run(self):
        if self.runtime_exceeded():
            raise MaxRuntimeExceeded("Sherlock: Max runtime exceeded.")

    def _report(
        self, since: datetime, frameworks: List[str], repositories: List[str]
    ) -> List[BackfillReport]:
        return self.report_maintainer.provide_updated_reports(since, frameworks, repositories)

    def _backfill(self, frameworks: List[str], repositories: List[str]):
        for platform in self.supported_platforms:
            self.__backfill_on(platform, frameworks, repositories)

    def __backfill_on(self, platform: str, frameworks: List[str], repositories: List[str]):
        left = self.secretary.backfills_left(on_platform=platform)
        total_consumed = 0

        records_to_backfill = self.__fetch_records_requiring_backfills_on(
            platform, frameworks, repositories
        )
        logger.info(
            f"Sherlock: {records_to_backfill.count()} records found to backfill on {platform.title()}."
        )

        for record in records_to_backfill:
            if left <= 0 or self.runtime_exceeded():
                break
            left, consumed = self._backfill_record(record, left)
            logger.info(f"Sherlock: Backfilled record with id {record.alert.id}.")
            # Model used for reporting backfill outcome
            BackfillNotificationRecord.objects.create(record=record)
            total_consumed += consumed

        self.secretary.consume_backfills(platform, total_consumed)
        logger.info(f"Sherlock: Consumed {total_consumed} backfills for {platform.title()}.")
        logger.debug(f"Sherlock: Having {left} backfills left on {platform.title()}.")

    @staticmethod
    def __fetch_records_requiring_backfills_on(
        platform: str, frameworks: List[str], repositories: List[str]
    ) -> QuerySet:
        records_to_backfill = BackfillRecord.objects.select_related(
            "alert",
            "alert__series_signature",
            "alert__series_signature__platform",
            "alert__summary__framework",
            "alert__summary__repository",
        ).filter(
            status=BackfillRecord.READY_FOR_PROCESSING,
            alert__series_signature__platform__platform__icontains=platform,
            alert__summary__framework__name__in=frameworks,
            alert__summary__repository__name__in=repositories,
        )
        return records_to_backfill

    def _backfill_record(self, record: BackfillRecord, left: int) -> Tuple[int, int]:
        consumed = 0

        try:
            context = record.get_context()
        except JSONDecodeError:
            logger.warning(f"Failed to backfill record {record.alert.id}: invalid JSON context.")
            record.status = BackfillRecord.FAILED
            record.save()
        else:
            data_points_to_backfill = self.__get_data_points_to_backfill(context)
            for data_point in data_points_to_backfill:
                if left <= 0 or self.runtime_exceeded():
                    break
                try:
                    using_job_id = data_point["job_id"]
                    self.backfill_tool.backfill_job(using_job_id)
                    left, consumed = left - 1, consumed + 1
                except (KeyError, CannotBackfill, Exception) as ex:
                    logger.debug(f"Failed to backfill record {record.alert.id}: {ex}")
                else:
                    record.try_remembering_job_properties(using_job_id)

            success, outcome = self._note_backfill_outcome(
                record, len(data_points_to_backfill), consumed
            )
            log_level = INFO if success else WARNING
            logger.log(log_level, f"{outcome} (for backfill record {record.alert.id})")

        return left, consumed

    @staticmethod
    def _note_backfill_outcome(
        record: BackfillRecord, to_backfill: int, actually_backfilled: int
    ) -> Tuple[bool, str]:
        success = False

        record.total_actions_triggered = actually_backfilled

        if actually_backfilled == to_backfill:
            record.status = BackfillRecord.BACKFILLED
            success = True
            outcome = "Backfilled all data points"
        else:
            record.status = BackfillRecord.FAILED
            if actually_backfilled == 0:
                outcome = "Backfill attempts on all data points failed right upon request."
            elif actually_backfilled < to_backfill:
                outcome = "Backfill attempts on some data points failed right upon request."
            else:
                raise ValueError(
                    f"Cannot have backfilled more than available attempts ({actually_backfilled} out of {to_backfill})."
                )

        record.set_log_details({"action": "BACKFILL", "outcome": outcome})
        record.save()
        return success, outcome

    @staticmethod
    def _is_queue_overloaded(provisioner_id: str, worker_type: str, acceptable_limit=100) -> bool:
        """
        Helper method for Sherlock to check load on processing queue.
        Usage example: _queue_is_too_loaded('gecko-3', 'b-linux')
        :return: True/False
        """
        tc = TaskclusterConfig("https://firefox-ci-tc.services.mozilla.com")
        tc.auth(client_id=CLIENT_ID, access_token=ACCESS_TOKEN)
        queue = tc.get_service("queue")

        pending_tasks_count = queue.pendingTasks(provisioner_id, worker_type).get("pendingTasks")

        return pending_tasks_count > acceptable_limit

    @staticmethod
    def __get_data_points_to_backfill(context: List[dict]) -> List[dict]:
        context_len = len(context)
        start = None

        if context_len == 1:
            start = 0
        elif context_len > 1:
            start = 1

        return context[start:]
