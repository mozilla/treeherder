import logging

from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.log_parser.crossreference import crossreference_job
from treeherder.model.models import Job

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Download, parse and store the given failure summary log.'

    def add_arguments(self, parser):
        parser.add_argument('job_id', type=int)

    def handle(self, *args, **options):
        logger.debug("crossreference_error_lines command")
        job_id = options['job_id']

        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            raise CommandError('Unknown job id %s' % job_id)
        crossreference_job(job)
