import logging
import requests

import simplejson as json

from treeherder.log_parser.artifactbuildercollection import (ArtifactBuilderCollection,
                                                             LogTooLargeException)
from treeherder.model.derived import ArtifactsModel
from treeherder.model.models import JobLog

logger = logging.getLogger(__name__)


def extract_text_log_artifacts(project, log_url, job_guid):
    """Generate a set of artifacts by parsing from the raw text log."""

    # parse a log given its url
    artifact_bc = ArtifactBuilderCollection(log_url)
    artifact_bc.parse()

    artifact_list = []
    for name, artifact in artifact_bc.artifacts.items():
        artifact_list.append({
            "job_guid": job_guid,
            "name": name,
            "type": 'json',
            "blob": json.dumps(artifact)
        })

    return artifact_list


def post_log_artifacts(project, job_guid, job_log):
    """Post a list of artifacts to a job."""
    log_url = job_log.url
    log_description = "%s %s (%s)" % (project, job_guid, log_url)
    logger.debug("Downloading/parsing log for %s", log_description)

    try:
        artifact_list = extract_text_log_artifacts(project, log_url, job_guid)
    except Exception as e:
        job_log.update_status(JobLog.FAILED)

        if isinstance(e, requests.ConnectionError):
            # possibly recoverable http error (e.g. problems on our end)
            logger.error("Failed to download log for %s: %s", log_description, e)
            # raise so this can retry
            raise

        # unrecoverable errors: don't retry on these

        #  http error (doesn't exist or permission denied)
        # (apparently this can happen somewhat often with taskcluster if
        # the job fails, so just warn about it -- see
        # https://bugzilla.mozilla.org/show_bug.cgi?id=1154248)
        if isinstance(e, requests.HTTPError) and e.response.status_code in (403, 404):
            err_msg = "Unable to retrieve log for {}: {}".format(log_description, e)
        elif isinstance(e, LogTooLargeException):
            # the log was too large to parse
            err_msg = e.message
        else:
            # parse error or other unrecoverable error
            err_msg = "Failed to download/parse log for {}: {}".format(log_description, e)

        logger.error(err_msg)
        # Store a job info that explains the unrecoverable problem with this log
        create_artifacts(project, [{
            "name": 'Job Info',
            "blob": {"job_details": [{
                'content_type': 'raw_html',
                'title': 'ERROR',
                'value': err_msg
            }]},
            "type": "json",
            "job_guid": job_guid
        }])

        # returning here will prevent retry, since these are all unrecoverable
        return

    try:
        serialized_artifacts = ArtifactsModel.serialize_artifact_json_blobs(
            artifact_list)
        with ArtifactsModel(project) as artifacts_model:
            artifacts_model.load_job_artifacts(serialized_artifacts)
        job_log.update_status(JobLog.PARSED)
        logger.debug("Stored artifact for %s %s", project, job_guid)
    except Exception as e:
        logger.error("Failed to store parsed artifact for %s: %s", log_description, e)
        raise
