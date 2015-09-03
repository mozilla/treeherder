# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import logging

from celery import task
from django.core.management import call_command
from treeherder import celery_app

logger = logging.getLogger(__name__)


@task(name='autostar', max_retries=10)
def autostar(project, job_guid):
    try:
        logger.info('Running autostar')
        call_command('autostar', job_guid, project)
        celery_app.send_task('detect-intermittents',
                             [project, job_guid],
                             routing_key='autostar')
    except Exception, e:
        autostar.retry(exc=e, countdown=(1 + autostar.request.retries) * 60)


@task(name='detect-intermittents', max_retries=10)
def detect_intermittents(project, job_guid):
    try:
        logger.info('Running detect intermittents')
        # TODO: Make this list configurable
        if project == "mozilla-inbound":
            call_command('detect_intermittents', job_guid, project)
    except Exception, e:
        detect_intermittents.retry(exc=e, countdown=(1 + detect_intermittents.request.retries) * 60)
