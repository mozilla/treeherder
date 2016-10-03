import logging

import requests
from redo import retry

HEADERS = {
    'Accept': 'application/json',
    'User-Agent': 'treeherder-seta',
}
LOG = logging.getLogger(__name__)
TRACKER = []  # It trackes which runnable jobs associated to a task ID we have already fetched
TREEHERDER_HOST = 'https://treeherder.mozilla.org'


class RunnableJobs():
    def __init__(self, treeherder_host=TREEHERDER_HOST):
        self.treeherder_host = treeherder_host
        self.api = treeherder_host + '/api/project/{0}/runnable_jobs/?decision_task_id={1}&format=json'

    def query_runnable_jobs(self, repo_name, task_id=None):
        global TRACKER

        if not task_id:
            task_id = self._query_latest_gecko_decision_task_id(repo_name)
            if not task_id:
                return None

        if task_id in TRACKER:
            LOG.info("We have already processed the data from this task (%s)." % task_id)
            return None
        else:
            TRACKER.append(task_id)
            LOG.info("We're going to fetch new runnable jobs data.")
            # We never store the output of runnable api but the minimal data we need
            return self._query_runnable_jobs(repo_name=repo_name, task_id=task_id)

    def _query_latest_gecko_decision_task_id(self, repo_name):
        url = "https://index.taskcluster.net/v1/task/gecko.v2.%s.latest.firefox.decision/" % repo_name
        try:
            LOG.info('Fetching {}'.format(url))
            latest_task = retry(
                requests.get,
                args=(url, ),
                kwargs={'headers': {'accept-encoding': 'json'}, 'verify': True}
            ).json()
            task_id = latest_task['taskId']
            LOG.info('For {} we found the task id: {}'.format(repo_name, task_id))
            return task_id
        except Exception as error:
            # we will end this function if got exception here
            LOG.warning("The request for %s failed due to %s" % (url, error))
            return None

    def _query_runnable_jobs(self, task_id, repo_name='mozilla-inbound'):
        url = self.api.format(repo_name, task_id)
        try:
            return retry(requests.get, args=(url, ), kwargs={'headers': HEADERS}).json()
        except Exception as e:
            LOG.warning("We failed to get runnablejobs via %s" % url)
            LOG.warning(str(e))
            return None
