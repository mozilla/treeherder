import logging
from datetime import datetime, timedelta
from json import JSONDecodeError
from logging import INFO, WARNING
from typing import List, Tuple

from django.conf import settings
from taskcluster.helper import TaskclusterConfig

from treeherder.perf.alerts import BackfillRecord, BackfillReport, BackfillReportMaintainer
from treeherder.perf.backfill_tool import BackfillTool
from treeherder.perf.exceptions import CannotBackfill, MaxRuntimeExceeded
from treeherder.perf.secretary_tool import SecretaryTool

logger = logging.getLogger(__name__)

CLIENT_ID = settings.PERF_SHERIFF_BOT_CLIENT_ID
ACCESS_TOKEN = settings.PERF_SHERIFF_BOT_ACCESS_TOKEN


class PerfSheriffBot:
    """
    Wrapper class used to aggregate the reporting of backfill reports.
    """

    DEFAULT_MAX_RUNTIME = timedelta(minutes=50)

    def __init__(
        self,
        report_maintainer: BackfillReportMaintainer,
        backfill_tool: BackfillTool,
        secretary_tool: SecretaryTool,
        max_runtime: timedelta = None,
        backfill_tool_disabled: bool = True,
        secretary_tool_disabled: bool = True,
    ):
        self.report_maintainer = report_maintainer
        self.backfill_tool = backfill_tool
        self.secretary = secretary_tool
        self._woke_up_time = datetime.now()
        self._max_runtime = self.DEFAULT_MAX_RUNTIME if max_runtime is None else max_runtime

        # TODO: feature flags; remove when enabled ->
        self.__backfill_tool_disabled = backfill_tool_disabled
        self.__secretary_tool_disabled = secretary_tool_disabled

        # extra precautions
        if self.__backfill_tool_disabled:
            self.backfill_tool = None
        if self.__secretary_tool_disabled:
            self.secretary = None
        # -> up to here

    def sheriff(self, since: datetime, frameworks: List[str], repositories: List[str]):
        self.assert_can_run()

        # secretary tool checks the status of all backfilled jobs
        # TODO: should not be enabled during soft launch - enable for the real launch
        # self.secretary.check_outcome()

        # reporter tool should always run *(only handles preliminary records/reports)*
        self._report(since, frameworks, repositories)
        self.assert_can_run()

        # backfill tool follows
        self._backfill()
        self.assert_can_run()

    def runtime_exceeded(self) -> bool:
        elapsed_runtime = datetime.now() - self._woke_up_time
        return self._max_runtime <= elapsed_runtime

    def assert_can_run(self):
        if self.runtime_exceeded():
            raise MaxRuntimeExceeded(f'Max runtime for {self.__class__.__name__} exceeded')

    def _report(
        self, since: datetime, frameworks: List[str], repositories: List[str]
    ) -> List[BackfillReport]:
        return self.report_maintainer.provide_updated_reports(since, frameworks, repositories)

    def _backfill(self):
        # TODO: feature flags; remove when enabled ->
        if self.__backfill_tool_disabled or self.__secretary_tool_disabled:
            return
        # -> up to here

        left = self.secretary.backfills_left(on_platform='linux')
        total_consumed = 0

        records_to_backfill = BackfillRecord.objects.filter(
            status=BackfillRecord.READY_FOR_PROCESSING
        )
        for record in records_to_backfill:
            if left <= 0 or self.runtime_exceeded():
                break
            left, consumed = self._backfill_record(record, left)
            total_consumed += consumed

        self.secretary.consume_backfills('linux', total_consumed)
        logger.debug(f'{self.__class__.__name__} has {left} backfills left.')

    def _backfill_record(self, record: BackfillRecord, left: int) -> Tuple[int, int]:
        consumed = 0

        try:
            context = record.get_context()
        except JSONDecodeError:
            logger.warning(f'Failed to backfill record {record.id}: invalid JSON context.')
            record.status = BackfillRecord.FAILED
            record.save()
        else:
            for data_point in context:
                if left <= 0 or self.runtime_exceeded():
                    break
                try:
                    self.backfill_tool.backfill_job(data_point['job_id'])
                    left, consumed = left - 1, consumed + 1
                except (KeyError, CannotBackfill, Exception) as ex:
                    logger.debug(f'Failed to backfill record {record.id}: {ex}')

            success, outcome = self._note_backfill_outcome(record, len(context), consumed)
            log_level = INFO if success else WARNING
            logger.log(log_level, f'{outcome} (for backfill record {record.id})')

        return left, consumed

    def _note_backfill_outcome(
        self, record: BackfillRecord, to_backfill: int, actually_backfilled: int
    ) -> Tuple[bool, str]:
        success = False

        if actually_backfilled == to_backfill:
            record.status = BackfillRecord.BACKFILLED
            success = True
            outcome = 'Backfilled all data points'
        else:
            record.status = BackfillRecord.FAILED
            if actually_backfilled == 0:
                outcome = 'Backfill attempts on all data points failed right upon request.'
            elif actually_backfilled < to_backfill:
                outcome = 'Backfill attempts on some data points failed right upon request.'
            else:
                raise ValueError(
                    f'Cannot have backfilled more than available attempts ({actually_backfilled} out of {to_backfill}).'
                )

        record.set_log_details({'action': 'BACKFILL', 'outcome': outcome})
        record.save()
        return success, outcome

    def _is_queue_overloaded(
        self, provisioner_id: str, worker_type: str, acceptable_limit=100
    ) -> bool:
        """
        Helper method for PerfSheriffBot to check load on processing queue.
        Usage example: _queue_is_too_loaded('gecko-3', 'b-linux')
        :return: True/False
        """
        tc = TaskclusterConfig('https://firefox-ci-tc.services.mozilla.com')
        tc.auth(client_id=CLIENT_ID, access_token=ACCESS_TOKEN)
        queue = tc.get_service('queue')

        pending_tasks_count = queue.pendingTasks(provisioner_id, worker_type).get('pendingTasks')

        return pending_tasks_count > acceptable_limit
