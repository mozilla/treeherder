import logging

from celery import task
from django.conf import settings
from django.core.management import call_command

from treeherder.autoclassify.tasks import autoclassify
from treeherder.log_parser.utils import (expand_log_url,
                                         extract_json_log_artifacts,
                                         extract_text_log_artifacts,
                                         is_parsed,
                                         post_log_artifacts)
from treeherder.workers.taskset import (create_taskset,
                                        taskset)

logger = logging.getLogger(__name__)


def parser_task(f):
    def inner(project, job_guid, job_log_url):
        job_log_url = expand_log_url(project, job_guid, job_log_url)

        if is_parsed(job_log_url):
            return True

        return f(project, job_guid, job_log_url)

    inner.__name__ = f.__name__
    inner.__doc__ = f.__doc__

    return inner


@task(name='parse-job-logs', max_retries=10)
def parse_job_logs(project, tasks):
    task_funcs = {"parse_json_log": parse_json_log,
                  "store_error_summary": store_error_summary,
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
            signature = task_funcs[t["func_name"]].si(project,
                                                      job_guid,
                                                      t['job_log_url'])
            if "routing_key" in t:
                signature.set(routing_key=t["routing_key"])
                priority = t["routing_key"].rsplit(".", 1)[1]
                if task_priorities[priority] > task_priorities[callback_priority]:
                    callback_priority = priority

            if t["func_name"] in ["parse_log", "store_error_summary"]:
                tasks.append(t["func_name"])
                callback_group.append(signature)
            else:
                signature.apply_async()

        if not callback_group:
            continue

        callback = after_logs_parsed.si(project, job_guid, callback_priority, tasks)
        callback.set(routing_key="after_logs_parsed.%s" % callback_priority)
        create_taskset(callback_group, callback)


@task(name='log-parser', max_retries=10)
@taskset
@parser_task
def parse_log(project, job_guid, job_log_url):
    """
    Call ArtifactBuilderCollection on the given job.
    """
    logger.error("Running parse_log for job %s" % job_guid)
    post_log_artifacts(project,
                       job_guid,
                       job_log_url,
                       parse_log,
                       extract_text_log_artifacts)
    return True


@task(name='log-parser-json', max_retries=10)
@parser_task
def parse_json_log(project, job_guid, job_log_url):
    """
    Apply the Structured Log Fault Formatter to the structured log for a job.
    """
    # The parse-json-log task has suddenly started taking 80x longer that it used to,
    # which is causing a backlog in normal log parsing tasks too. The output of this
    # task is not being used yet, so skip parsing until this is resolved.
    # See bug 1152681.
    return True

    # don't parse a log if it's already been parsed
    if is_parsed(project, job_guid, job_log_url):
        return True

    post_log_artifacts(project,
                       job_guid,
                       job_log_url,
                       parse_json_log,
                       extract_json_log_artifacts,
                       )

    return True


@task(name='store-error-summary', max_retries=10)
@taskset
@parser_task
def store_error_summary(project, job_guid, job_log_url):
    """This task is a wrapper for the store_error_summary command."""
    try:
        logger.error('Running store_error_summary for job %s' % job_guid)
        call_command('store_error_summary', project, job_guid, job_log_url['url'])
    except Exception as e:
        store_error_summary.retry(exc=e, countdown=(1 + store_error_summary.request.retries) * 60)

    return True


@task(name='after-logs-parsed', max_retries=10)
def after_logs_parsed(project, job_guid, priority, tasks):
    logger.error("Running after_logs_parsed for job %s priority %s" % (job_guid, priority))

    signatures = []

    if "parse_log" in tasks and "store_error_summary" in tasks:
        crossreference_task = crossreference_error_lines.s(project, job_guid)
        crossreference_task.set(routing_key="crossreference_error_lines.%s" % priority)
        signatures = [crossreference_task]

        if settings.AUTOCLASSIFY_JOBS:
            classify_task = autoclassify.s(project, job_guid)
            classify_task.set(routing_key="autoclassify.%s" % priority)
            signatures.append(classify_task)

    for signature in signatures:
        signature.apply_async()

    return True


@task(name='crossreference-error-lines', max_retries=10)
def crossreference_error_lines(project, job_guid):
    """This task is a wrapper for the store_error_summary command."""
    logger.error("Running crossreference-error-lines for %s" % job_guid)
    try:
        call_command('crossreference_error_lines', project, job_guid)
    except Exception, e:
        crossreference_error_lines.retry(exc=e, countdown=(1 + crossreference_error_lines.request.retries) * 60)

    return True
