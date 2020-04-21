from datetime import datetime
from typing import List

from django.conf import settings
from taskcluster.helper import TaskclusterConfig

from treeherder.perf.alerts import BackfillReport

CLIENT_ID = settings.PERF_SHERIFF_BOT_CLIENT_ID
ACCESS_TOKEN = settings.PERF_SHERIFF_BOT_ACCESS_TOKEN


class PerfSheriffBot:
    """
    Wrapper class used to aggregate the reporting of backfill reports.
    """

    def __init__(self, report_maintainer):
        self.report_maintainer = report_maintainer

    def report(
        self, since: datetime, frameworks: List[str], repositories: List[str]
    ) -> List[BackfillReport]:
        return self.report_maintainer.provide_updated_reports(since, frameworks, repositories)

    def _is_queue_overloaded(
        self, provisioner_id: str, worker_type: str, acceptable_limit=100
    ) -> bool:
        '''
        Helper method for PerfSheriffBot to check load on processing queue.
        Usage example: _queue_is_too_loaded('gecko-3', 'b-linux')
        :return: True/False
        '''
        tc = TaskclusterConfig('https://firefox-ci-tc.services.mozilla.com')
        tc.auth(client_id=CLIENT_ID, access_token=ACCESS_TOKEN)
        queue = tc.get_service('queue')

        pending_tasks_count = queue.pendingTasks(provisioner_id, worker_type).get('pendingTasks')

        return pending_tasks_count > acceptable_limit
