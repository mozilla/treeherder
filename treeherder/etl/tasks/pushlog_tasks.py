import logging

import newrelic.agent
from celery import shared_task

from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.models import Repository

logger = logging.getLogger(__name__)


@shared_task(name="fetch-push-logs")
def fetch_push_logs():
    """
    Run several fetch_hg_push_log or fetch_git_push_log subtasks, one per repository.

    For hg repos that have a git_url configured, dispatches to the git-first
    polling task which tries Git and falls back to Hg.
    """
    for repo in Repository.objects.filter(dvcs_type="hg", active_status="active"):
        if repo.git_url:
            fetch_git_push_log.apply_async(
                args=(repo.name, repo.git_url, repo.git_branch or "main", repo.url),
                queue="pushlog",
            )
        else:
            fetch_hg_push_log.apply_async(args=(repo.name, repo.url), queue="pushlog")


@shared_task(name="fetch-hg-push-logs", soft_time_limit=10 * 60)
def fetch_hg_push_log(repo_name, repo_url):
    """
    Run a HgPushlog etl process
    """
    newrelic.agent.add_custom_attribute("repo_name", repo_name)
    process = HgPushlogProcess()
    process.run(repo_url + "/json-pushes/?full=1&version=2", repo_name)


@shared_task(name="fetch-git-push-logs", soft_time_limit=10 * 60)
def fetch_git_push_log(repo_name, git_url, git_branch, hg_url_fallback):
    """
    Fetch push data from Git (GitHub), falling back to Hg on failure.

    This task is dispatched for hg repos that have a git_url configured,
    enabling a gradual migration from Hg to Git-based push ingestion.
    """
    newrelic.agent.add_custom_attribute("repo_name", repo_name)
    try:
        from treeherder.etl.git_pushlog import GitPushlogProcess

        process = GitPushlogProcess()
        process.run(git_url, git_branch, repo_name)
    except Exception:
        logger.warning(
            "Git push fetch failed for %s, falling back to Hg",
            repo_name,
            exc_info=True,
        )
        process = HgPushlogProcess()
        process.run(hg_url_fallback + "/json-pushes/?full=1&version=2", repo_name)
