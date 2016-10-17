import logging

import newrelic.agent
from django.conf import settings

from treeherder.autoclassify.tasks import autoclassify
from treeherder.log_parser.crossreference import crossreference_job
from treeherder.log_parser.utils import post_log_artifacts
from treeherder.model.models import (Job,
                                     JobLog)
from treeherder.workers.task import retryable_task
from treeherder.workers.taskset import (create_taskset,
                                        taskset)

from . import failureline

logger = logging.getLogger(__name__)


def parser_task(f):
    """Decorator that ensures that log parsing task has not already run,
    and also adds New Relic annotations.
    """
    def inner(job_log_id, priority):
        newrelic.agent.add_custom_parameter("job_log_id", job_log_id)
        job_log = JobLog.objects.select_related("job").get(id=job_log_id)
        newrelic.agent.add_custom_parameter("job_log_name", job_log.name)
        newrelic.agent.add_custom_parameter("job_log_url", job_log.url)
        newrelic.agent.add_custom_parameter("job_log_status_prior",
                                            job_log.get_status_display())
        if job_log.status == JobLog.PARSED:
            logger.info("log already parsed")
            return True

        return f(job_log)

    inner.__name__ = f.__name__
    inner.__doc__ = f.__doc__

    return inner


def parse_job_log(func_name, routing_key, job_log):
    """
    Schedule the log-related tasks to parse an individual log
    """
    task_funcs = {
        "store_failure_lines": store_failure_lines,
        "parse_log": parse_log,
    }

    task_priorities = {
        "normal": 0,
        "failures": 1,
    }

    callback_priority = "normal"

    callback_group = []

    logger.debug("parse_job_log for job log %s (%s, %s)",
                 job_log.id, func_name, routing_key)
    priority = routing_key.rsplit(".", 1)[1]
    if task_priorities[priority] > task_priorities[callback_priority]:
        callback_priority = priority

    signature = task_funcs[func_name].si(job_log.id)
    signature.set(routing_key=routing_key)

    if func_name in ["parse_log", "store_failure_lines"]:
        callback_group.append(signature)
    else:
        signature.apply_async()

    if callback_group:
        callback = crossreference_error_lines.si(job_log.job.id,
                                                 callback_priority)
        callback.set(routing_key="crossreference_error_lines.%s" %
                     callback_priority)
        create_taskset(callback_group, callback)


@retryable_task(name='log-parser', max_retries=10)
@taskset
@parser_task
def parse_log(job_log):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    post_log_artifacts(job_log)


@retryable_task(name='store-failure-lines', max_retries=10)
@taskset
@parser_task
<<<<<<< HEAD
def store_failure_lines(job_log, priority):
    """Store the failure lines from a log corresponding to the structured
    errorsummary file."""
    logger.debug('Running store_failure_lines for job %s' % job_log.job.id)
    failureline.store_failure_lines(job_log)


@retryable_task(name='crossreference-error-lines', max_retries=10)
def crossreference_error_lines(job_id):
    """Match structured (FailureLine) and unstructured (TextLogError) lines
    for a job."""
    newrelic.agent.add_custom_parameter("job_id", job_id)
    logger.debug("Running crossreference-error-lines for job %s" % job_id)
    job = Job.objects.get(id=job_id)
    has_lines = crossreference_job(job)
    if has_lines and settings.AUTOCLASSIFY_JOBS:
        autoclassify.apply_async(args=[job_id.job.id],
                                 routing_key="autoclassify.%s" % priority)
