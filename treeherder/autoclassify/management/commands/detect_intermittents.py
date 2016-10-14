from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.autoclassify.detect_intermittents import detect
from treeherder.model.models import Job


class Command(BaseCommand):
    args = '<job_id>'
    help = 'Look for new intermittents in a job'

    def handle(self, *args, **options):
        if not len(args) == 1:
            raise CommandError('1 argument required, %s given' % len(args))
        job_id, = args
        job = Job.objects.select_related('repository').get(id=job_id)
        detect(job)
