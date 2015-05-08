# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import urllib2
import logging
import time

import simplejson as json
from django.conf import settings

from treeherder.log_parser.artifactbuildercollection import \
    ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import MozlogArtifactBuilder

from treeherder.model.bug_suggestions import get_bug_suggestions_artifacts

from treeherder.client import TreeherderArtifactCollection, TreeherderRequest
from treeherder.etl.oauth_utils import OAuthCredentials

logger = logging.getLogger(__name__)


def is_parsed(job_log_url):
    # if parse_status is not available, consider it pending
    parse_status = job_log_url.get("parse_status", "pending")
    return parse_status == "parsed"


def extract_text_log_artifacts(log_url, job_guid, check_errors):
    """Generate a summary artifact for the raw text log."""

    # parse a log given its url
    artifact_bc = ArtifactBuilderCollection(log_url,
                                            check_errors=check_errors)
    artifact_bc.parse()

    artifact_list = []
    for name, artifact in artifact_bc.artifacts.items():
        artifact_list.append({
            "job_guid": job_guid,
            "name": name,
            "type": 'json',
            "blob": json.dumps(artifact)
        })

    bs_artifact_list = get_bug_suggestions_artifacts(artifact_list)
    if bs_artifact_list:
        artifact_list.extend(bs_artifact_list)

    return artifact_list


def extract_json_log_artifacts(log_url, job_guid, check_errors):
    """ Generate a summary artifact for the mozlog json log. """
    logger.debug("Parsing JSON log at url: {0}".format(log_url))

    ab = MozlogArtifactBuilder(log_url)
    ab.parse_log()

    return [{
        "job_guid": job_guid,
        "name": ab.name,
        "type": 'json',
        "blob": json.dumps(ab.get_artifact())
    }]


def post_log_artifacts(project,
                       job_guid,
                       job_log_url,
                       retry_task,
                       extract_artifacts_cb,
                       check_errors=False):
    """Post a list of artifacts to a job."""
    def _retry(e):
        # Initially retry after 1 minute, then for each subsequent retry
        # lengthen the retry time by another minute.
        retry_task.retry(exc=e, countdown=(1 + retry_task.request.retries) * 60)
        # .retry() raises a RetryTaskError exception,
        # so nothing after this function will be executed

    log_description = "%s %s (%s)" % (project, job_guid, job_log_url['url'])
    logger.debug("Downloading/parsing log for %s", log_description)

    credentials = OAuthCredentials.get_credentials(project)
    req = TreeherderRequest(
        protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
        host=settings.TREEHERDER_REQUEST_HOST,
        project=project,
        oauth_key=credentials.get('consumer_key', None),
        oauth_secret=credentials.get('consumer_secret', None),
    )

    try:
        artifact_list = extract_artifacts_cb(job_log_url['url'],
                                             job_guid, check_errors)
    except Exception as e:
        update_parse_status(req, job_log_url, 'failed')
        if isinstance(e, urllib2.HTTPError) and e.code in (403, 404):
            logger.debug("Unable to retrieve log for %s: %s", log_description, e)
            return
        logger.error("Failed to download/parse log for %s: %s", log_description, e)
        _retry(e)

    # store the artifacts generated
    tac = TreeherderArtifactCollection()
    for artifact in artifact_list:
        ta = tac.get_artifact(artifact)
        tac.add(ta)

    try:
        req.post(tac)
        update_parse_status(req, job_log_url, 'parsed')
        logger.debug("Finished posting artifact for %s %s", project, job_guid)
    except Exception as e:
        logger.error("Failed to upload parsed artifact for %s: %s", log_description, e)
        _retry(e)


def update_parse_status(req, job_log_url, parse_status):
    update_endpoint = 'job-log-url/{}/update_parse_status'.format(job_log_url['id'])
    current_timestamp = time.time()
    req.send(
        update_endpoint,
        method='POST',
        data={
            'parse_status': parse_status,
            'parse_timestamp': current_timestamp
        }
    )
