# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.


import logging

from celery import task
from django.core.management import call_command

from treeherder.log_parser.utils import (extract_json_log_artifacts,
                                         extract_text_log_artifacts, is_parsed,
                                         post_log_artifacts)

logger = logging.getLogger(__name__)


@task(name='parse-log', max_retries=10)
def parse_log(project, job_log_url, job_guid):
    """
    Call ArtifactBuilderCollection on the given job.
    """

    # don't parse a log if it's already been parsed
    if is_parsed(job_log_url):
        return

    post_log_artifacts(project,
                       job_guid,
                       job_log_url,
                       parse_log,
                       extract_text_log_artifacts,
                       )


@task(name='parse-json-log', max_retries=10)
def parse_json_log(project, job_log_url, job_guid):
    """
    Apply the Structured Log Fault Formatter to the structured log for a job.
    """
    # The parse-json-log task has suddenly started taking 80x longer that it used to,
    # which is causing a backlog in normal log parsing tasks too. The output of this
    # task is not being used yet, so skip parsing until this is resolved.
    # See bug 1152681.
    return

    # don't parse a log if it's already been parsed
    if is_parsed(job_log_url):
        return

    post_log_artifacts(project,
                       job_guid,
                       job_log_url,
                       parse_json_log,
                       extract_json_log_artifacts,
                       )


@task(name='store-error-summary', max_retries=10)
def store_error_summary(project, job_log_url, job_guid):
    """This task is a wrapper for the store_error_summary command."""
    try:
        logger.info('Running store_error_summary')
        call_command('store_error_summary', job_log_url, job_guid, project)
    except Exception, e:
        store_error_summary.retry(exc=e, countdown=(1 + store_error_summary.request.retries) * 60)
