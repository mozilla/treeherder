import newrelic.agent
from celery import task

from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.models import Repository


@task(name='fetch-push-logs')
def fetch_push_logs():
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    for repo in Repository.objects.filter(dvcs_type='hg', active_status="active"):
        fetch_hg_push_log.apply_async(args=(repo.name, repo.url), queue='pushlog')


@task(name='fetch-hg-push-logs', soft_time_limit=10 * 60)
def fetch_hg_push_log(repo_name, repo_url):
    """
    Run a HgPushlog etl process
    """
    newrelic.agent.add_custom_parameter("repo_name", repo_name)
    process = HgPushlogProcess()
    process.run(repo_url + '/json-pushes/?full=1&version=2', repo_name)
