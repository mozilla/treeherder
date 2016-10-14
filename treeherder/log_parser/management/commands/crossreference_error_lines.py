import logging

from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.log_parser.crossreference import crossreference_job
from treeherder.model.models import Job

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    args = '<job_id>'
    help = 'Download, parse and store the given failure summary log.'

    def handle(self, *args, **options):
        logger.debug("crossreference_error_lines command")
        if len(args) != 1:
            raise CommandError('1 argument required, %s given' % len(args))

        job_id, = args

        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            raise CommandError('Unknown job id %s' % job_id)
        crossreference_job(job)
