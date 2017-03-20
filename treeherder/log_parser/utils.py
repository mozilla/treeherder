import logging
import urllib2

import simplejson as json

from treeherder.etl.artifact import (serialize_artifact_json_blobs,
                                     store_job_artifacts)
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.model.models import JobLog

logger = logging.getLogger(__name__)


def extract_text_log_artifacts(job_log):
    """Generate a set of artifacts by parsing from the raw text log."""

    # parse a log given its url
    artifact_bc = ArtifactBuilderCollection(job_log.url)
    artifact_bc.parse()

    artifact_list = []
    for name, artifact in artifact_bc.artifacts.items():
        artifact_list.append({
            "job_guid": job_log.job.guid,
            "name": name,
            "type": 'json',
            "blob": json.dumps(artifact)
        })

    return artifact_list


def post_log_artifacts(job_log):
    """Post a list of artifacts to a job."""
    logger.debug("Downloading/parsing log for log %s", job_log.id)

    try:
        artifact_list = extract_text_log_artifacts(job_log)
    except Exception as e:
        job_log.update_status(JobLog.FAILED)

        # Unrecoverable http error (doesn't exist or permission denied).
        # Apparently this can happen somewhat often with taskcluster if
        # the job fails (bug 1154248), so just warn rather than raising,
        # to prevent the noise/load from retrying.
        if isinstance(e, urllib2.HTTPError) and e.code in (403, 404):
            logger.warning("Unable to retrieve log for %s: %s", job_log.id, e)
            return

        logger.error("Failed to download/parse log for %s: %s", job_log.id, e)
        raise

    try:
        serialized_artifacts = serialize_artifact_json_blobs(artifact_list)
        store_job_artifacts(serialized_artifacts)
        job_log.update_status(JobLog.PARSED)
        logger.debug("Stored artifact for %s %s", job_log.job.repository.name,
                     job_log.job.id)
    except Exception as e:
        logger.error("Failed to store parsed artifact for %s: %s", job_log.id, e)
        raise
