# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import requests
import logging

from celery import task
from treeherder.model.derived import RefDataManager
from treeherder.etl.pushlog import MissingHgPushlogProcess

logger = logging.getLogger(__name__)


@task(name='fetch-missing-push-logs')
def fetch_missing_push_logs(missing_pushlogs):
    """
    Run several fetch_hg_push_log subtasks, one per repository
    """
    with RefDataManager() as rdm:
        repos = filter(lambda x: x['url'], rdm.get_all_repository_info())
        for repo in repos:
            if repo['dvcs_type'] == 'hg' and repo['name'] in missing_pushlogs:
                # we must get them one at a time, because if ANY are missing
                # from json-pushes, it'll return a 404 for the group.
                for resultset in missing_pushlogs[repo['name']]:
                    fetch_missing_hg_push_logs.apply_async(args=(
                        repo['name'],
                        repo['url'],
                        resultset
                    ),
                        routing_key='fetch_missing_push_logs'
                    )


@task(name='fetch-missing-hg-push-logs', time_limit=3 * 60)
def fetch_missing_hg_push_logs(repo_name, repo_url, resultset):
    """
    Run a HgPushlog etl process

    ``revisions`` is a list of changeset values truncated to 12 chars.
    """
    process = MissingHgPushlogProcess()

    changesetParam = {"changeset": resultset}
    url_str = repo_url + '/json-pushes/?full=1&' + changesetParam

    logger.info("fetching missing resultsets: {0}".format(url_str))
    process.run(url_str, repo_name, resultset)
