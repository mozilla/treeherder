import logging

import newrelic.agent
from django.conf import settings

from treeherder import celery_app
from treeherder.autoclassify.autoclassify import match_errors
from treeherder.autoclassify.detect_intermittents import detect
from treeherder.model.models import Job
from treeherder.workers.task import retryable_task

logger = logging.getLogger(__name__)


@retryable_task(name='autoclassify', max_retries=10)
def autoclassify(job_id):
    newrelic.agent.add_custom_parameter("job_id", job_id)
    logger.info('Running autoclassify')
    job = Job.objects.select_related("repository").get(id=job_id)
    match_errors(job)
    if settings.DETECT_INTERMITTENTS:
        celery_app.send_task('detect-intermittents',
                             [job_id],
                             routing_key='detect_intermittents')


@retryable_task(name='detect-intermittents', max_retries=10)
def detect_intermittents(job_id):
    newrelic.agent.add_custom_parameter("job_id", job_id)
    logger.info('Running detect intermittents')
    # TODO: Make this list configurable
    job = Job.objects.select_related('repository').get(id=job_id)
    if job.repository.name == "mozilla-inbound":
        detect(job)
