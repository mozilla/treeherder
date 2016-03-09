import logging

from celery import task
from django.conf import settings
from django.core.management import call_command

from treeherder.autoclassify.tasks import autoclassify
from treeherder.log_parser.utils import (expand_log_url,
                                         extract_text_log_artifacts,
                                         is_parsed,
                                         post_log_artifacts)
from treeherder.workers.taskset import (create_taskset,
                                        taskset)

logger = logging.getLogger(__name__)


def parser_task(f):
    def inner(project, job_guid, job_log_url, priority):
        job_log_url = expand_log_url(project, job_guid, job_log_url)

        if is_parsed(job_log_url):
            return True

        return f(project, job_guid, job_log_url, priority)

    inner.__name__ = f.__name__
    inner.__doc__ = f.__doc__

    return inner


def parse_job_logs(project, tasks):
    task_funcs = {"store_failure_lines": store_failure_lines,
                  "parse_log": parse_log}

    task_priorities = {"normal": 0,
                       "failures": 1,
                       "high": 2}

    callback_priority = "normal"

    for job_guid, task_list in tasks.iteritems():
        callback_group = []
        tasks = []

        logger.error("parse_job_logs for job %s" % job_guid)
        for t in task_list:

            priority = t["routing_key"].rsplit(".", 1)[1] if "routing_key" in t else "normal"
            if task_priorities[priority] > task_priorities[callback_priority]:
                callback_priority = priority

            signature = task_funcs[t["func_name"]].si(project,
                                                      job_guid,
                                                      t['job_log_url'],
                                                      priority)
            if "routing_key" in t:
                signature.set(routing_key=t["routing_key"])

            if t["func_name"] in ["parse_log", "store_failure_lines"]:
                tasks.append(t["func_name"])
                callback_group.append(signature)
            else:
                signature.apply_async()

        if not callback_group:
            continue

        callback = crossreference_error_lines.si(project, job_guid, tasks)
        callback.set(routing_key="crossreference_error_lines.%s" % callback_priority)
        create_taskset(callback_group, callback)


@task(name='log-parser', max_retries=10)
@taskset
@parser_task
def parse_log(project, job_guid, job_log_url, _priority):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    logger.error("Running parse_log for job %s" % job_guid)
    post_log_artifacts(project,
                       job_guid,
                       job_log_url,
                       parse_log,
                       extract_text_log_artifacts)


@task(name='store-failure-lines', max_retries=10)
@taskset
@parser_task
def store_failure_lines(project, job_guid, job_log_url, priority):
    """This task is a wrapper for the store_failure_lines command."""
    try:
        logger.error('Running store_failure_lines for job %s' % job_guid)
        call_command('store_failure_lines', project, job_guid, job_log_url['url'])
        if settings.AUTOCLASSIFY_JOBS:
            autoclassify.apply_async(args=[project, job_guid],
                                     routing_key="autoclassify.%s" % priority)

    except Exception as e:
        store_failure_lines.retry(exc=e, countdown=(1 + store_failure_lines.request.retries) * 60)


@task(name='crossreference-error-lines', max_retries=10)
def crossreference_error_lines(project, job_guid, tasks):
    """This task is a wrapper for the crossreference error lines command."""
    logger.error("Running crossreference-error-lines for %s" % job_guid)
    if not("parse_log" in tasks and "store_failure_lines" in tasks):
        return
    try:
        call_command('crossreference_error_lines', project, job_guid)
    except Exception, e:
        crossreference_error_lines.retry(exc=e, countdown=(1 + crossreference_error_lines.request.retries) * 60)
