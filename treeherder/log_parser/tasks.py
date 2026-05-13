import logging

import newrelic.agent
import simplejson as json
from celery.exceptions import SoftTimeLimitExceeded
from requests.exceptions import HTTPError

from treeherder.etl.artifact import serialize_artifact_json_blobs, store_job_artifacts
from treeherder.etl.text import astral_filter
from treeherder.log_parser.artifactbuildercollection import (
    ArtifactBuilderCollection,
    LogSizeError,
)
from treeherder.model.models import Job, JobLog, StructuredLogError
from treeherder.utils.http import fetch_text
from treeherder.workers.task import retryable_task

from . import failureline, intermittents

logger = logging.getLogger(__name__)


@retryable_task(name="log-parser", max_retries=10)
def parse_logs(job_id, job_log_ids, priority):
    newrelic.agent.add_custom_attribute("job_id", str(job_id))

    job = Job.objects.get(id=job_id)
    job_logs = JobLog.objects.filter(id__in=job_log_ids, job=job)

    if len(job_log_ids) != len(job_logs):
        logger.warning(
            "Failed to load all expected job ids: %s", ", ".join([str(j) for j in job_log_ids])
        )

    parser_tasks = {
        "errorsummary_json": store_failure_lines,
        "live_backing_log": post_log_artifacts,
        "structured_log": post_structured_log_artifacts,
    }

    # We don't want to stop parsing logs for most Exceptions however we still
    # need to know one occurred so we can skip further steps and reraise to
    # trigger the retry decorator.
    first_exception = None
    completed_names = set()
    for job_log in job_logs:
        newrelic.agent.add_custom_attribute(f"job_log_{job_log.name}_url", job_log.url)
        logger.info("parser_task for %s", job_log.id)

        # Only parse logs which haven't yet been processed or else failed on the last attempt.
        if job_log.status not in (JobLog.PENDING, JobLog.FAILED):
            logger.info(
                f"Skipping parsing for job %s since log already processed.  Log Status: {job_log.status}",
                job_log.id,
            )
            continue

        parser = parser_tasks.get(job_log.name)
        if not parser:
            continue

        try:
            parser(job_log)
        except Exception as e:
            if isinstance(e, SoftTimeLimitExceeded):
                # stop parsing further logs but raise so NewRelic and
                # Papertrail will still show output
                raise

            if first_exception is None:
                first_exception = e

            # track the exception on NewRelic but don't stop parsing future
            # log lines.
            newrelic.agent.notice_error()
        else:
            completed_names.add(job_log.name)

    # Raise so we trigger the retry decorator.
    if first_exception:
        raise first_exception


def store_failure_lines(job_log):
    """Store the failure lines from a log corresponding to the structured
    errorsummary file."""
    logger.info("Running store_failure_lines for job %s", job_log.job.id)
    failureline.store_failure_lines(job_log)
    intermittents.check_and_mark_intermittent(job_log.job.id)


def post_log_artifacts(job_log):
    """Post a list of artifacts to a job."""
    logger.info("Downloading/parsing log for log %s", job_log.id)

    try:
        artifact_list = extract_text_log_artifacts(job_log)
    except LogSizeError as e:
        job_log.update_status(JobLog.SKIPPED_SIZE)
        logger.warning("Skipping parsing log for %s: %s", job_log.id, e)
        return
    except Exception as e:
        job_log.update_status(JobLog.FAILED)

        # Unrecoverable http error (doesn't exist or permission denied).
        # Apparently this can happen somewhat often with taskcluster if
        # the job fails (bug 1154248), so just warn rather than raising,
        # to prevent the noise/load from retrying.
        if isinstance(e, HTTPError) and e.response.status_code in (403, 404):
            logger.warning("Unable to retrieve log for %s: %s", job_log.id, e)
            return

        logger.error("Failed to download/parse log for %s: %s", job_log.id, e)
        raise

    try:
        serialized_artifacts = serialize_artifact_json_blobs(artifact_list)
        store_job_artifacts(serialized_artifacts)
        job_log.update_status(JobLog.PARSED)
        logger.info(
            "Stored artifact for %s %s %s", job_log.job.repository.name, job_log.job.id, job_log.id
        )
    except Exception as e:
        logger.error("Failed to store parsed artifact for %s: %s", job_log.id, e)
        raise


def post_structured_log_artifacts(job_log):
    """Download a structured (mozlog JSON-lines) log and store error entries."""
    logger.info("Downloading/parsing structured log for log %s", job_log.id)

    try:
        log_text = fetch_text(job_log.url)
    except HTTPError as e:
        job_log.update_status(JobLog.FAILED)
        if e.response is not None and e.response.status_code in (403, 404):
            logger.warning("Unable to retrieve structured log for %s: %s", job_log.id, e)
            return
        logger.error("Failed to download structured log for %s: %s", job_log.id, e)
        raise
    except Exception as e:
        job_log.update_status(JobLog.FAILED)
        logger.error("Failed to download structured log for %s: %s", job_log.id, e)
        raise

    if not log_text:
        job_log.update_status(JobLog.PARSED)
        return

    error_entries = []
    for raw_line in log_text.splitlines():
        try:
            entry = json.loads(raw_line)
        except (ValueError, TypeError):
            continue
        if not isinstance(entry, dict):
            continue
        level = (entry.get("level") or "").upper()
        if level not in ("ERROR", "CRITICAL"):
            continue

        time_value = entry.get("time")
        if isinstance(time_value, float):
            time_value = int(time_value)
        elif not isinstance(time_value, int):
            time_value = None

        pid_value = entry.get("pid")
        if not isinstance(pid_value, int) or pid_value < 0:
            pid_value = None

        error_entries.append(
            StructuredLogError(
                job_log=job_log,
                action=str(entry.get("action") or "")[:32],
                time=time_value,
                thread=astral_filter(str(entry.get("thread") or ""))[:255],
                pid=pid_value,
                source=astral_filter(str(entry.get("source") or ""))[:255],
                message=astral_filter(str(entry.get("message") or "")),
                level=level[:16],
            )
        )

    try:
        StructuredLogError.objects.filter(job_log=job_log).delete()
        if error_entries:
            StructuredLogError.objects.bulk_create(error_entries)
        job_log.update_status(JobLog.PARSED)
        logger.info(
            "Stored structured log errors for %s %s %s",
            job_log.job.repository.name,
            job_log.job.id,
            job_log.id,
        )
    except Exception as e:
        logger.error("Failed to store structured log errors for %s: %s", job_log.id, e)
        raise


def extract_text_log_artifacts(job_log):
    """Generate a set of artifacts by parsing from the raw text log."""

    # parse a log given its url
    artifact_bc = ArtifactBuilderCollection(job_log.url)
    artifact_bc.parse()

    artifact_list = []
    for name, artifact in artifact_bc.artifacts.items():
        artifact_list.append(
            {
                "job_guid": job_log.job.guid,
                "name": name,
                "type": "json",
                "blob": json.dumps(artifact),
            }
        )

    return artifact_list
