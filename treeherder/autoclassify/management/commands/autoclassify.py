from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.autoclassify.autoclassify import match_errors
from treeherder.model.models import Job


class Command(BaseCommand):
    args = '<id>'
    help = 'Mark failures on a job.'

    def handle(self, *args, **options):

        if len(args) != 1:
            raise CommandError('1 argument required, %s given' % len(args))

        job_id, = args

        job = Job.objects.select_related("repository").get(id=job_id)
        match_errors(job)
