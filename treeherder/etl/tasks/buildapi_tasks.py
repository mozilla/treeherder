"""
This module contains
"""
import newrelic.agent
from celery import task

from treeherder.etl.allthethings import RunnableJobsProcess
from treeherder.etl.buildapi import (Builds4hJobsProcess,
                                     PendingJobsProcess,
                                     RunningJobsProcess)
from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.models import Repository


@task(name='fetch-buildapi-pending', time_limit=3 * 60)
def fetch_buildapi_pending():
    """
    Fetches the buildapi pending jobs api and load them
    """
    PendingJobsProcess().run()


@task(name='fetch-buildapi-running', time_limit=3 * 60)
def fetch_buildapi_running():
    """
    Fetches the buildapi running jobs api and load them
    """
    RunningJobsProcess().run()


@task(name='fetch-buildapi-build4h', time_limit=3 * 60)
def fetch_buildapi_build4h():
    """
    Fetches the buildapi running jobs api and load them
    """
    Builds4hJobsProcess().run()


@task(name='fetch-allthethings', time_limit=10 * 60)
def fetch_allthethings():
    """
    Fetches possible jobs from allthethings and load them
    """
    RunnableJobsProcess().run()


@task(name='fetch-push-logs')
def fetch_push_logs():
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    for repo in Repository.objects.filter(dvcs_type='hg',
                                          active_status="active"):
        fetch_hg_push_log.apply_async(
            args=(repo.name, repo.url),
            routing_key='pushlog'
        )


@task(name='fetch-hg-push-logs', time_limit=3 * 60)
def fetch_hg_push_log(repo_name, repo_url):
    """
    Run a HgPushlog etl process
    """
    newrelic.agent.add_custom_parameter("repo_name", repo_name)
    process = HgPushlogProcess()
    process.run(repo_url + '/json-pushes/?full=1&version=2', repo_name)
