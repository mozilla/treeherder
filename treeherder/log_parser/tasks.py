# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.


import logging
import time
from celery import task
from django.conf import settings

from thclient import TreeherderArtifactCollection, TreeherderRequest


from treeherder.log_parser.utils import (get_error_search_term,
                                         get_crash_signature,
                                         get_bugs_for_search_term,
                                         get_mozharness_substring,
                                         extract_log_artifacts)

from treeherder.etl.oauth_utils import OAuthCredentials


logger = logging.getLogger(__name__)

@task(name='parse-log', max_retries=10)
def parse_log(project, job_log_url, job_guid, check_errors=False):
    """
    Call ArtifactBuilderCollection on the given job.
    """

    # if parse_status is not available, consider it pending
    parse_status = job_log_url.get("parse_status", "pending")
    # don't parse a log if it's already been parsed
    if parse_status == "parsed":
        return

    try:
        credentials = OAuthCredentials.get_credentials(project)
        req = TreeherderRequest(
            protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
            host=settings.TREEHERDER_REQUEST_HOST,
            project=project,
            oauth_key=credentials.get('consumer_key', None),
            oauth_secret=credentials.get('consumer_secret', None),
        )
        update_endpoint = 'job-log-url/{0}/update_parse_status'.format(
            job_log_url['id']
        )

        logger.debug("Downloading and extracting log information for guid "
                     "'%s' (from %s)" % (job_guid, job_log_url['url']))

        artifact_list = extract_log_artifacts(job_log_url['url'],
                                              job_guid, check_errors)
        # store the artifacts generated
        tac = TreeherderArtifactCollection()
        for artifact in artifact_list:
            ta = tac.get_artifact({
                "job_guid": artifact[0],
                "name": artifact[1],
                "type": artifact[2],
                "blob": artifact[3]
            })
            tac.add(ta)

        logger.debug("Finished downloading and processing artifact for guid "
                     "'%s'" % job_guid)

        req.post(tac)

        # send an update to job_log_url
        # the job_log_url status changes from pending to parsed
        current_timestamp = time.time()
        req.send(
            update_endpoint,
            method='POST',
            data={
                'parse_status': 'parsed',
                'parse_timestamp': current_timestamp
            }
        )

        logger.debug("Finished posting artifact for guid '%s'" % job_guid)

    except Exception, e:
        # send an update to job_log_url
        #the job_log_url status changes from pending/running to failed
        logger.warn("Failed to download and/or parse artifact for guid '%s'" %
                    job_guid)
        current_timestamp = time.time()
        req.send(
            update_endpoint,
            method='POST',
            data={
                'parse_status': 'failed',
                'parse_timestamp': current_timestamp
            }
        )
        # for every retry, set the countdown to 10 minutes
        # .retry() raises a RetryTaskError exception,
        # so nothing below this line will be executed.
        parse_log.retry(exc=e, countdown=10*60)
