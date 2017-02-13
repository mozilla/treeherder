import logging

import newrelic.agent
from django.conf import settings

from treeherder import celery_app
from treeherder.autoclassify.autoclassify import match_errors
from treeherder.model.models import Job
from treeherder.workers.task import retryable_task

logger = logging.getLogger(__name__)


@retryable_task(name='autoclassify', max_retries=10)
def autoclassify(job_id):
    newrelic.agent.add_custom_parameter("job_id", job_id)
    logger.info('Running autoclassify')
    job = Job.objects.select_related("repository").get(id=job_id)
    match_errors(job)
