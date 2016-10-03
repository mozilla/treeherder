import logging

from treeherder.etl.common import fetch_json
from treeherder.etl.runnable_jobs import list_runnable_jobs

logger = logging.getLogger(__name__)


class RunnableJobsClient():
    def __init__(self, treeherder_host='https://treeherder.mozilla.org',
                 tc_index_url='https://index.taskcluster.net/v1/task/gecko.v2.%s.latest.firefox.decision'):
        self.tc_index_url = tc_index_url
        self.cache = {}

    def query_runnable_jobs(self, repo_name, task_id=None):
        '''Return runnable_jobs data

        Calling this repo without task_id is optimal as we then only cache the latest runnable jobs.

        We do caching because the data does not really change and because bug 1288028 makes calls to
        the runnable_jobs API very slow.
        '''
        if repo_name not in self.cache:
            self.cache[repo_name] = {}

        if not task_id:
            task_id = self._query_latest_gecko_decision_task_id(repo_name)
            self.cache[repo_name]['latest'] = self._query_runnable_jobs(repo_name=repo_name, task_id=task_id)
            return self.cache[repo_name]['latest']
        else:
            if task_id in self.cache:
                # XXX: In previous code, we were returning None; what should we do for this case?
                logger.info("We have already processed the data from this task (%s)." % task_id)
                return self.cache[repo_name][task_id]
            else:
                logger.info("We're going to fetch new runnable jobs data.")
                self.cache[repo_name][task_id] = self._query_runnable_jobs(repo_name=repo_name, task_id=task_id)
                return self.cache[repo_name][task_id]

    def _query_latest_gecko_decision_task_id(self, repo_name):
        url = self.tc_index_url % repo_name
        logger.info('Fetching {}'.format(url))
        latest_task = fetch_json(url)
        task_id = latest_task['taskId']
        logger.info('For {} we found the task id: {}'.format(repo_name, task_id))
        return task_id

    def _query_runnable_jobs(self, repo_name, task_id):
        return list_runnable_jobs(repo_name, task_id)
