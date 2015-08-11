import logging
import urllib2

import simplejson as json
from django.conf import settings

from treeherder import celery_app
from treeherder.client import (TreeherderArtifactCollection, TreeherderAuth,
                               TreeherderClient)
from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.log_parser.artifactbuildercollection import \
    ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import MozlogArtifactBuilder
from treeherder.model.error_summary import get_error_summary_artifacts

logger = logging.getLogger(__name__)


def is_parsed(job_log_url):
    # if parse_status is not available, consider it pending
    parse_status = job_log_url.get("parse_status", "pending")
    return parse_status == "parsed"


def extract_text_log_artifacts(project, log_url, job_guid):
    """Generate a summary artifact for the raw text log."""

    # parse a log given its url
    artifact_bc = ArtifactBuilderCollection(log_url)
    artifact_bc.parse()

    artifact_list = []
    for name, artifact in artifact_bc.artifacts.items():
        if name == 'Job Info':
            for detail in artifact['job_details']:
                if ('title' in detail and detail['title'] == 'artifact uploaded'
                        and detail['value'].endswith('_errorsummary.log')):
                    # using .send_task to avoid an import loop.
                    celery_app.send_task('store-error-summary',
                                         [project, detail['url'], job_guid],
                                         routing_key='store_error_summary')
        artifact_list.append({
            "job_guid": job_guid,
            "name": name,
            "type": 'json',
            "blob": json.dumps(artifact)
        })

    artifact_list.extend(get_error_summary_artifacts(artifact_list))

    return artifact_list


def extract_json_log_artifacts(project, log_url, job_guid):
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
                       extract_artifacts_cb):
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
    auth = TreeherderAuth(credentials.get('consumer_key'),
                          credentials.get('consumer_secret'),
                          project)
    client = TreeherderClient(
        protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
        host=settings.TREEHERDER_REQUEST_HOST,
        auth=auth
    )

    try:
        artifact_list = extract_artifacts_cb(project, job_log_url['url'],
                                             job_guid)
    except Exception as e:
        client.update_parse_status(project, job_log_url['id'], 'failed')
        # unrecoverable http error (doesn't exist or permission denied)
        # (apparently this can happen somewhat often with taskcluster if
        # the job fails, so just warn about it -- see
        # https://bugzilla.mozilla.org/show_bug.cgi?id=1154248)
        if isinstance(e, urllib2.HTTPError) and e.code in (403, 404):
            logger.warning("Unable to retrieve log for %s: %s",
                           log_description, e)
            return
        # possibly recoverable http error (e.g. problems on our end)
        elif isinstance(e, urllib2.URLError):
            logger.error("Failed to download log for %s: %s",
                         log_description, e)
            _retry(e)
        # parse error or other unrecoverable error
        else:
            logger.error("Failed to download/parse log for %s: %s",
                         log_description, e)
        # re-raise exception if we're not retrying, so new relic sees the
        # error
        raise

    # store the artifacts generated
    tac = TreeherderArtifactCollection()
    for artifact in artifact_list:
        ta = tac.get_artifact(artifact)
        tac.add(ta)

    try:
        client.post_collection(project, tac)
        client.update_parse_status(project, job_log_url['id'], 'parsed')
        logger.debug("Finished posting artifact for %s %s", project, job_guid)
    except Exception as e:
        logger.error("Failed to upload parsed artifact for %s: %s", log_description, e)
        _retry(e)
