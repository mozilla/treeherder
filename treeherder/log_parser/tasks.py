import logging

import newrelic.agent
from celery.exceptions import SoftTimeLimitExceeded

from treeherder.autoclassify.tasks import autoclassify
from treeherder.log_parser.crossreference import crossreference_job
from treeherder.log_parser.utils import post_log_artifacts
from treeherder.model.models import (Job,
                                     JobLog)
from treeherder.workers.task import retryable_task

from . import failureline

logger = logging.getLogger(__name__)


@retryable_task(name='log-parser', max_retries=10)
def parse_logs(job_id, job_log_ids, priority):
    newrelic.agent.add_custom_parameter("job_id", str(job_id))

    job = Job.objects.get(id=job_id)
    job_logs = JobLog.objects.filter(id__in=job_log_ids,
                                     job=job)

    if len(job_log_ids) != len(job_logs):
        logger.warning("Failed to load all expected job ids: %s", ", ".join(job_log_ids))

    parser_tasks = {
        "errorsummary_json": store_failure_lines,
        "buildbot_text": parse_unstructured_log,
        "builds-4h": parse_unstructured_log
    }

    # We don't want to stop parsing logs for most Exceptions however we still
    # need to know one occurred so we can skip further steps and reraise to
    # trigger the retry decorator.
    first_exception = None
    completed_names = set()
    for job_log in job_logs:
        newrelic.agent.add_custom_parameter("job_log_%s_url" % job_log.name, job_log.url)
        logger.debug("parser_task for %s", job_log.id)

        # Don't parse jobs which have already been parsed.
        if job_log.status == JobLog.PARSED:
            logger.info("%s log already parsed", job_log.id)
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

            if isinstance(e, SystemExit):
                # stop parsing further logs because the process was told to
                # exit, this is commonly because the Heroku Dynos were
                # restarted.
                raise

            if first_exception is None:
                first_exception = e

            # track the exception on NewRelic but don't stop parsing future
            # log lines.
            newrelic.agent.record_exception()
        else:
            completed_names.add(job_log.name)

    # Raise so we trigger the retry decorator.
    if first_exception:
        raise first_exception

    if ("errorsummary_json" in completed_names and
        ("buildbot_text" in completed_names or
         "builds-4h" in completed_names)):

        success = crossreference_error_lines(job)

        if success:
            logger.debug("Scheduling autoclassify for job %i", job_id)
            autoclassify.apply_async(
                args=[job_id],
                routing_key="autoclassify.%s" % priority)
        else:
            job.autoclassify_status = Job.SKIPPED
    else:
        job.autoclassify_status = Job.SKIPPED
    job.save()


def parse_unstructured_log(job_log):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    logger.debug('Running parse_unstructured_log for job %s', job_log.job.id)
    post_log_artifacts(job_log)


def store_failure_lines(job_log):
    """Store the failure lines from a log corresponding to the structured
    errorsummary file."""
    logger.debug('Running store_failure_lines for job %s', job_log.job.id)
    failureline.store_failure_lines(job_log)


def crossreference_error_lines(job):
    """Match structured (FailureLine) and unstructured (TextLogError) lines
    for a job."""
    logger.debug("Crossreference %s: started", job.id)
    success = crossreference_job(job)
    return success
