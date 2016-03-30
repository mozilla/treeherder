import logging
import urllib

from celery import task

from treeherder.etl.pushlog import MissingHgPushlogProcess
from treeherder.model.models import Repository

logger = logging.getLogger(__name__)


@task(name='fetch-missing-push-logs')
def fetch_missing_push_logs(missing_pushlogs):
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    for repo in Repository.objects.filter(dvcs_type='hg'):
        if repo.name in missing_pushlogs:
            # we must get them one at a time, because if ANY are missing
            # from json-pushes, it'll return a 404 for the group.
            for resultset in missing_pushlogs[repo.name]:
                fetch_missing_hg_push_logs.apply_async(
                    args=(repo.name, repo.url, resultset),
                    routing_key='fetch_missing_push_logs')


@task(name='fetch-missing-hg-push-logs', time_limit=3 * 60)
def fetch_missing_hg_push_logs(repo_name, repo_url, resultset):
    """
    Run a HgPushlog etl process

    ``revisions`` is a list of changeset values truncated to 12 chars.
    """
    process = MissingHgPushlogProcess()

    changesetParam = urllib.urlencode({"changeset": resultset}, True)
    url_str = repo_url + '/json-pushes/?full=1&version=2&' + changesetParam

    logger.info("fetching missing resultsets: {0}".format(url_str))
    process.run(url_str, repo_name, resultset)
