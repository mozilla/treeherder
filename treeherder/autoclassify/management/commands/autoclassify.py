from django.core.management.base import BaseCommand

from treeherder.autoclassify.autoclassify import match_errors
from treeherder.model.models import Job


class Command(BaseCommand):
    help = 'Mark failures on a job.'

    def add_arguments(self, parser):
        parser.add_argument('job_id', type=int)

    def handle(self, *args, **options):
        job = Job.objects.select_related("repository").get(id=options['job_id'])
        match_errors(job)
