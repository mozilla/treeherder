import logging

import newrelic.agent
from django.conf import settings
from django.core.management import call_command

from treeherder import celery_app
from treeherder.workers.task import retryable_task

logger = logging.getLogger(__name__)


@retryable_task(name='autoclassify', max_retries=10)
def autoclassify(project, job_guid):
    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("job_guid", job_guid)
    logger.info('Running autoclassify')
    call_command('autoclassify', project, job_guid)
    if settings.DETECT_INTERMITTENTS:
        celery_app.send_task('detect-intermittents',
                             [project, job_guid],
                             routing_key='detect_intermittents')


@retryable_task(name='detect-intermittents', max_retries=10)
def detect_intermittents(project, job_guid):
    newrelic.agent.add_custom_parameter("project", project)
    newrelic.agent.add_custom_parameter("job_guid", job_guid)
    logger.info('Running detect intermittents')
    # TODO: Make this list configurable
    if project == "mozilla-inbound":
        call_command('detect_intermittents', project, job_guid)
