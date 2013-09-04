"""
This module contains
"""
from celery import task
from .buildapi import (RunningJobsProcess,
                                     PendingJobsProcess,
                                     Builds4hJobsProcess)
from treeherder.model.derived import RefDataManager
from .pushlog import HgPushlogProcess, GitPushlogProcess


@task(name='fetch-buildapi-pending')
def fetch_buildapi_pending():
    """
    Fetches the buildapi pending jobs api and load them to
    the objectstore ingestion endpoint
    """
    PendingJobsProcess().run()


@task(name='fetch-buildapi-running')
def fetch_buildapi_pending():
    """
    Fetches the buildapi running jobs api and load them to
    the objectstore ingestion endpoint
    """
    RunningJobsProcess().run()


@task(name='fetch-buildapi-build4h')
def fetch_buildapi_build4h():
    """
    Fetches the buildapi running jobs api and load them to
    the objectstore ingestion endpoint
    """
    Builds4hJobsProcess().run()


@task(name='fetch-push-logs')
def fetch_push_logs():
    """
    this is supposed to be used as a periodic task
    to be run every minute
    """
    for repo in RefDataManager.get_all_repository_info():
        if repo['dvcs_type'] == 'hg':
            fetch_hg_push_log.delay(repo['name'], repo['url'])
        elif repo['dvcs_type'] == 'hg':
            fetch_git_push_log.delay(repo['name'], repo['url'])


@task(name='fetch-hg-push-logs')
def fetch_hg_push_log(repo_name, repo_url):
    """
    Run a HgPushlog etl process
    """
    process = HgPushlogProcess()
    process.run()


@task(name='fetch-git-push-logs')
def fetch_git_push_log(repo_name, repo_url):
    """
    Run a GitsPushlog etl process
    """
    process = GitPushlogProcess()
    process.run()
