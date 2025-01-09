import logging

import simplejson as json
from django.db.utils import IntegrityError

from treeherder.etl.perf import store_performance_artifact
from treeherder.etl.text import astral_filter
from treeherder.model import error_summary
from treeherder.model.models import Job, TextLogError

logger = logging.getLogger(__name__)


def store_text_log_summary_artifact(job, text_log_summary_artifact):
    """
    Store the contents of the text log summary artifact
    """
    errors = json.loads(text_log_summary_artifact["blob"])["errors"]

    log_errors = TextLogError.objects.bulk_create(
        [
            TextLogError(
                job=job,
                line_number=error["linenumber"],
                line=astral_filter(error["line"]),
            )
            for error in errors
        ],
        # Duplicate error lines may be processed
        ignore_conflicts=True,
    )

    # Bulk create doesn't return .id field, so query to get them.
    log_errors = TextLogError.objects.filter(job=job)

    # get error summary immediately (to warm the cache)
    # Conflicts may have occured during the insert, but we pass the queryset for performance
    bugs = error_summary.get_error_summary(job, queryset=log_errors)
    for suggestion in bugs:
        if (suggestion["failure_new_in_rev"] or suggestion["counter"] == 0) and job.result not in [
            "success",
            "unknown",
            "usercancel",
            "retry",
        ]:
            # classify job as `new failure` - for filtering, etc.
            job.failure_classification_id = 6
            job.save(update_fields=["failure_classification_id"])
            # for every log_errors (TLE object) there is a corresponding bugs/suggestion
            for tle in log_errors:
                if tle.line_number == suggestion["line_number"]:
                    tle.new_failure = True
                    tle.save(update_fields=["new_failure"])
                    break


def store_job_artifacts(artifact_data):
    """
    Store a list of job artifacts. All of the datums in artifact_data need
    to be in the following format:

        {
            'type': 'json',
            'name': 'my-artifact-name',
            # blob can be any kind of structured data
            'blob': { 'stuff': [1, 2, 3, 4, 5] },
            'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
        }

    """
    for artifact in artifact_data:
        # Determine what type of artifact we have received
        if artifact:
            artifact_name = artifact.get("name")
            if not artifact_name:
                logger.error("load_job_artifacts: Unnamed job artifact, skipping")
                continue
            job_guid = artifact.get("job_guid")
            if not job_guid:
                logger.error(
                    f"load_job_artifacts: Artifact '{artifact_name}' with no job guid set, skipping"
                )
                continue

            try:
                job = Job.objects.get(guid=job_guid)
            except Job.DoesNotExist:
                logger.error("load_job_artifacts: No job_id for guid %s", job_guid)
                continue

            if artifact_name == "performance_data":
                store_performance_artifact(job, artifact)
            elif artifact_name == "text_log_summary":
                try:
                    store_text_log_summary_artifact(job, artifact)
                except IntegrityError:
                    logger.warning(
                        "Couldn't insert text log information "
                        "for job with guid %s, this probably "
                        "means the job was already parsed",
                        job_guid,
                    )
            else:
                logger.warning(
                    "Unknown artifact type: %s submitted with job %s", artifact_name, job.guid
                )
        else:
            logger.error("store_job_artifacts: artifact type %s not understood", artifact_name)


def serialize_artifact_json_blobs(artifacts):
    """
    Ensure that JSON artifact blobs passed as dicts are converted to JSON
    """
    for artifact in artifacts:
        blob = artifact["blob"]
        if artifact["type"].lower() == "json" and not isinstance(blob, str):
            artifact["blob"] = json.dumps(blob)

    return artifacts
