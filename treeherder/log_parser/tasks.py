import logging

import newrelic.agent
from django.conf import settings

from treeherder.autoclassify.tasks import autoclassify
from treeherder.log_parser.crossreference import crossreference_job
from treeherder.log_parser.utils import post_log_artifacts
from treeherder.model.models import (Job,
                                     JobLog)
from treeherder.workers.task import retryable_task

from . import failureline

logger = logging.getLogger(__name__)


def if_not_parsed(f):
    """Decorator that ensures that log parsing task has not already run
    """
    def inner(job_log):
        newrelic.agent.add_custom_parameter("job_log_%i_name" % job_log.id, job_log.name)
        newrelic.agent.add_custom_parameter("job_log_%i_url" % job_log.id, job_log.url)

        logger.debug("parser_task for %s" % job_log.id)
        if job_log.status == JobLog.PARSED:
            logger.info("%s log already parsed" % job_log.id)
            return True

        return f(job_log)

    inner.__name__ = f.__name__
    inner.__doc__ = f.__doc__

    return inner


@retryable_task(name='log-parser', max_retries=10)
def parse_logs(job_id, job_log_ids, priority):
    job = Job.objects.get(id=job_id)
    job_logs = JobLog.objects.filter(id__in=job_log_ids,
                                     job=job)

    newrelic.agent.add_custom_parameter("job_id", job.id)

    if len(job_log_ids) != len(job_logs):
        logger.warning("Failed to load all expected job ids: %s" % ", ".join(job_log_ids))
    parser_tasks = {
        "errorsummary_json": store_failure_lines,
        "buildbot_text": parse_unstructured_log,
        "builds-4h": parse_unstructured_log
    }

    completed_names = set()
    exceptions = []
    for job_log in job_logs:
        parser = parser_tasks.get(job_log.name)
        if parser:
            try:
                parser(job_log)
            except Exception as e:
                exceptions.append(e)
            else:
                completed_names.add(job_log.name)

    if exceptions:
        raise exceptions[0]

    if ("errorsummary_json" in completed_names and
        ("buildbot_text" in completed_names or
         "builds-4h" in completed_names)):

        success = crossreference_error_lines(job)

        if success and settings.AUTOCLASSIFY_JOBS:
            logger.debug("Scheduling autoclassify for job %i" % job_id)
            autoclassify.apply_async(
                args=[job_id],
                routing_key="autoclassify.%s" % priority)
        else:
            job.autoclassify_status = Job.SKIPPED
    else:
        job.autoclassify_status = Job.SKIPPED
    job.save()


@if_not_parsed
def parse_unstructured_log(job_log):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    logger.debug('Running parse_unstructured_log for job %s' % job_log.job.id)
    post_log_artifacts(job_log)


@if_not_parsed
def store_failure_lines(job_log):
    """Store the failure lines from a log corresponding to the structured
    errorsummary file."""
    logger.debug('Running store_failure_lines for job %s' % job_log.job.id)
    failureline.store_failure_lines(job_log)


def crossreference_error_lines(job):
    """Match structured (FailureLine) and unstructured (TextLogError) lines
    for a job."""
    logger.debug("Crossreference %s: started" % job.id)
    success = crossreference_job(job)
    return success
