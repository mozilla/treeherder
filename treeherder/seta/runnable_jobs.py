import logging

import requests
from redo import retry

HEADERS = {
    'Accept': 'application/json',
    'User-Agent': 'treeherder-seta',
}
LOG = logging.getLogger(__name__)


class RunnableJobsClient():
    def __init__(self, treeherder_host='https://treeherder.mozilla.org',
                 tc_index_url='https://index.taskcluster.net/v1/task/gecko.v2.%s.latest.firefox.decision'):
        self.tc_index_url = tc_index_url
        self.th_api = treeherder_host + '/api/project/{0}/runnable_jobs/?decision_task_id={1}&format=json'
        self.cache = {}

    def query_runnable_jobs(self, repo_name, task_id=None):
        '''Return runnable_jobs data

        Calling this repo without task_id is optimal as we then only cache the latest runnable jobs.

        We do caching because the data does not really change and because bug 1288028 makes calls to
        the runnable_jobs API very slow.
        '''
        if not repo_name in self.cache:
            self.cache[repo_name] = {}

        if not task_id:
            task_id = self._query_latest_gecko_decision_task_id(repo_name)
            self.cache[repo_name]['latest'] = self._query_runnable_jobs(repo_name=repo_name, task_id=task_id)
            return self.cache[repo_name]['latest']
        else:
            if task_id in self.cache:
                # XXX: In previous code, we were returning None; what should we do for this case?
                LOG.info("We have already processed the data from this task (%s)." % task_id)
                return self.cache[repo_name][task_id]
            else:
                LOG.info("We're going to fetch new runnable jobs data.")
                self.cache[repo_name][task_id] = self._query_runnable_jobs(repo_name=repo_name, task_id=task_id)
                return self.cache[repo_name][task_id]

    def _query_latest_gecko_decision_task_id(self, repo_name):
        url = self.tc_index_url % repo_name
        LOG.info('Fetching {}'.format(url))
        latest_task = retry(
            requests.get,
            args=(url, ),
            kwargs={'headers': {'accept-encoding': 'json'}, 'verify': True}
        ).json()
        task_id = latest_task['taskId']
        LOG.info('For {} we found the task id: {}'.format(repo_name, task_id))
        return task_id

    def _query_runnable_jobs(self, repo_name, task_id):
        url = self.th_api.format(repo_name, task_id)
        return retry(requests.get, args=(url, ), kwargs={'headers': HEADERS}).json()
