# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

"""
This module contains
"""
from celery import task
from treeherder.model.derived import RefDataManager
from treeherder.etl.buildapi import (RunningJobsProcess,
                                     PendingJobsProcess,
                                     Builds4hJobsProcess)
from treeherder.etl.pushlog import HgPushlogProcess


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


@task(name='fetch-push-logs')
def fetch_push_logs():
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    with RefDataManager() as rdm:
        repos = filter(lambda x: x['url'], rdm.get_all_repository_info())
        for repo in repos:
            if repo['dvcs_type'] == 'hg':
                fetch_hg_push_log.apply_async(
                    args=(repo['name'], repo['url']),
                    routing_key='pushlog'
                )


@task(name='fetch-hg-push-logs', time_limit=3 * 60)
def fetch_hg_push_log(repo_name, repo_url):
    """
    Run a HgPushlog etl process
    """
    process = HgPushlogProcess()
    process.run(repo_url + '/json-pushes/?full=1', repo_name)
