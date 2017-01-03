from django.core.management.base import BaseCommand

from treeherder.autoclassify.detect_intermittents import detect
from treeherder.model.models import Job


class Command(BaseCommand):
    help = 'Look for new intermittents in a job'

    def add_arguments(self, parser):
        parser.add_argument('job_id', type=int)

    def handle(self, *args, **options):
        job = Job.objects.select_related('repository').get(id=options['job_id'])
        detect(job)
