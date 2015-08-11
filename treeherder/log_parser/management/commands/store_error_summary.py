from cStringIO import StringIO

import requests
from django.core.management.base import BaseCommand, CommandError
from mozlog import reader

from treeherder.model.derived import JobsModel
from treeherder.model.models import Failure, Repository


class Command(BaseCommand):
    args = '<log_url>, <job_guid>, <repository>'
    help = 'Download, parse and store the given failure summary log.'

    def handle(self, *args, **options):

        if not len(args) == 3:
            raise CommandError('3 arguments required, %s given' % len(args))
        log_response = requests.get(args[0], timeout=30)
        log_response.raise_for_status()

        if log_response.text:
            log_content = StringIO(log_response.text)

            try:
                repository = Repository.objects.get(name=args[2], active_status='active')
            except Repository.DoesNotExist:
                raise CommandError('Unknown repository %s' % args[2])

            log_iter = reader.read(log_content)

            with JobsModel(args[2]) as jobs_model:
                job_id = jobs_model.get_job_ids_by_guid([args[1]])
                if not job_id:
                    raise CommandError('No job found with guid %s in the %s repository' % (args[1], args[2]))

            Failure.objects.bulk_create(
                [Failure(repository=repository, job_guid=args[1], **failure)
                 for failure in log_iter]
            )
