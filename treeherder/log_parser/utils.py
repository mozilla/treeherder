import logging
import urllib2

import simplejson as json

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.model.derived import ArtifactsModel
from treeherder.model.error_summary import (get_artifacts_that_need_bug_suggestions,
                                            get_error_summary_artifacts)
from treeherder.model.models import JobLog
from treeherder.model.tasks import populate_error_summary

logger = logging.getLogger(__name__)


def extract_text_log_artifacts(project, log_url, job_guid):
    """Generate a summary artifact for the raw text log."""

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

    artifact_list.extend(get_error_summary_artifacts(artifact_list))

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
        create_artifacts(project, artifact_list)
        job_log.update_status(JobLog.PARSED)
        logger.debug("Stored artifact for %s %s", project, job_guid)
    except Exception as e:
        logger.error("Failed to store parsed artifact for %s: %s", log_description, e)
        raise


def create_artifacts(project, data):
    artifacts = ArtifactsModel.serialize_artifact_json_blobs(data)

    with ArtifactsModel(project) as artifacts_model:

        artifacts_model.load_job_artifacts(artifacts)

        # If a ``text_log_summary`` and ``Bug suggestions`` artifact are
        # posted here together, for the same ``job_guid``, then just load
        # them.  This is how it is done internally in our log parser
        # so there is no delay in creation and the bug suggestions show
        # as soon as the log is parsed.
        #
        # If a ``text_log_summary`` is posted WITHOUT an accompanying
        # ``Bug suggestions`` artifact, then schedule to create it
        # asynchronously so that this api does not take too long.

        tls_list = get_artifacts_that_need_bug_suggestions(artifacts)

        # tls_list will contain all ``text_log_summary`` artifacts that
        # do NOT have an accompanying ``Bug suggestions`` artifact in this
        # current list of artifacts.  If it's empty, then we don't need
        # to schedule anything.
        if tls_list:
            populate_error_summary.apply_async(
                args=[project, tls_list],
                routing_key='error_summary'
            )
