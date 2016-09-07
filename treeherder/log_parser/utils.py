import logging
import urllib2

import simplejson as json

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
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

        # unrecoverable http error (doesn't exist or permission denied)
        # (apparently this can happen somewhat often with taskcluster if
        # the job fails, so just warn about it -- see
        # https://bugzilla.mozilla.org/show_bug.cgi?id=1154248)
        if isinstance(e, urllib2.HTTPError) and e.code in (403, 404):
            logger.warning("Unable to retrieve log for %s: %s", log_description, e)
            return

        if isinstance(e, urllib2.URLError):
            # possibly recoverable http error (e.g. problems on our end)
            logger.error("Failed to download log for %s: %s", log_description, e)
        else:
            # parse error or other unrecoverable error
            logger.error("Failed to download/parse log for %s: %s", log_description, e)
        raise

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
