import logging

import newrelic.agent
from celery.exceptions import SoftTimeLimitExceeded

from treeherder.model.models import Job, JobLog
from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import PerformanceSignature
from treeherder.workers.task import retryable_task

logger = logging.getLogger(__name__)


@retryable_task(name="generate-alerts", max_retries=10)
def generate_alerts(signature_id):
    newrelic.agent.add_custom_attribute("signature_id", str(signature_id))
    signature = PerformanceSignature.objects.get(id=signature_id)
    generate_new_alerts_in_series(signature)


@retryable_task(name="ingest-perfherder-data", max_retries=10)
def ingest_perfherder_data(job_id, job_log_ids):
    from treeherder.perf.ingest_data import post_perfherder_artifacts

    newrelic.agent.add_custom_attribute("job_id", str(job_id))

    job = Job.objects.get(id=job_id)
    job_artifacts = JobLog.objects.filter(id__in=job_log_ids, job=job)

    if len(job_log_ids) != len(job_artifacts):
        logger.warning(
            "Failed to load all expected job ids: %s", ", ".join([str(j) for j in job_log_ids])
        )

    first_exception = None
    for job_artifact in job_artifacts:
        job_artifact_name = job_artifact.name.replace("-", "_")
        if not job_artifact_name.startswith("perfherder_data"):
            continue

        newrelic.agent.add_custom_attribute(f"job_log_{job_artifact.name}_url", job_artifact.url)
        logger.info("ingest_perfherder_data for %s", job_artifact.id)

        if job_artifact.status not in (JobLog.PENDING, JobLog.FAILED):
            logger.info(
                "Skipping ingest_perfherder_data for job %s since artifact already processed.  Log Status: %s",
                job_artifact.id,
                job_artifact.status,
            )
            continue

        try:
            post_perfherder_artifacts(job_artifact)
        except Exception as e:
            if isinstance(e, SoftTimeLimitExceeded):
                # stop parsing further logs but raise so NewRelic and
                # Papertrail will still show output
                raise

            if first_exception is None:
                first_exception = e

            newrelic.agent.notice_error()
            logger.exception("Failed ingesting perfherder JSON for log %s", job_artifact.id)

    if first_exception:
        raise first_exception
