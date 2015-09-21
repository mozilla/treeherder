import logging

from celery import task
from django.core.management import call_command
from treeherder import celery_app

logger = logging.getLogger(__name__)


@task(name='autoclassify', max_retries=10)
def autoclassify(project, job_guid):
    try:
        logger.info('Running autoclassify')
        call_command('autoclassify', job_guid, project)
        celery_app.send_task('detect-intermittents',
                             [project, job_guid],
                             routing_key='detect_intermittents')
    except Exception, e:
        autoclassify.retry(exc=e, countdown=(1 + autoclassify.request.retries) * 60)


@task(name='detect-intermittents', max_retries=10)
def detect_intermittents(project, job_guid):
    try:
        logger.info('Running detect intermittents')
        # TODO: Make this list configurable
        if project == "mozilla-inbound":
            call_command('detect_intermittents', job_guid, project)
    except Exception, e:
        detect_intermittents.retry(exc=e, countdown=(1 + detect_intermittents.request.retries) * 60)
