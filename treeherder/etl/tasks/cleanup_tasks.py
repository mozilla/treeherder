import urllib
from celery import task, group
from treeherder.model.derived import RefDataManager
from treeherder.etl.pushlog import MissingHgPushlogProcess


@task(name='fetch-missing-push-logs')
def fetch_missing_push_logs(missing_pushlogs):
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    rdm = RefDataManager()
    try:
        repos = filter(lambda x: x['url'], rdm.get_all_repository_info())
        # create a group of subtasks and apply them
        g = group(fetch_missing_hg_push_logs.si(
            repo['name'],
            repo['url'],
            missing_pushlogs[repo['name']]
            )
            for repo in repos if repo['dvcs_type'] == 'hg' and repo['name'] in missing_pushlogs)
        g()
    finally:
        rdm.disconnect()


@task(name='fetch-missing-hg-push-logs', time_limit=3*60)
def fetch_missing_hg_push_logs(repo_name, repo_url, revisions):
    """
    Run a HgPushlog etl process

    ``revisions`` is a list of changeset values truncated to 12 chars.
    """
    process = MissingHgPushlogProcess()

    changesetParam = urllib.urlencode({"changeset": revisions}, True)
    urlStr = repo_url + '/json-pushes/?full=1&' + changesetParam

    process.run(urlStr, repo_name)


