from cStringIO import StringIO
from itertools import islice

from django.conf import settings
from django.core.management.base import (BaseCommand,
                                         CommandError)
from django.db import transaction
from mozlog import reader

from treeherder.etl.common import fetch_text
from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     Repository)


class Command(BaseCommand):
    args = '<repository>, <job_guid>, <log_url>'
    help = 'Download, parse and store the given failure summary log.'

    def handle(self, *args, **options):
        try:
            repository_name, job_guid, log_url = args
        except ValueError:
            raise CommandError('3 arguments required, %s given' % len(args))

        log_text = fetch_text(log_url)

        if not log_text:
            return

        log_content = StringIO(log_text)

        try:
            repository = Repository.objects.get(name=repository_name, active_status='active')
        except Repository.DoesNotExist:
            raise CommandError('Unknown repository %s' % repository_name)

        log_iter = reader.read(log_content)

        failure_lines_cutoff = settings.FAILURE_LINES_CUTOFF
        log_iter = list(islice(log_iter, failure_lines_cutoff+1))

        if len(log_iter) > failure_lines_cutoff:
            # Alter the N+1th log line to indicate the list was truncated.
            log_iter[-1].update(action='truncated')

        with JobsModel(repository_name) as jm:
            job = jm.get_job_ids_by_guid([job_guid])[job_guid]

            if not job:
                raise CommandError('No job found with guid %s in the %s repository' % (job_guid, repository_name))

            job_log_url = jm.get_job_log_url_by_url(job["id"], log_url)

            with transaction.atomic():
                FailureLine.objects.bulk_create(
                    [FailureLine(repository=repository, job_guid=job_guid, **failure_line)
                     for failure_line in log_iter]
                )

            jm.update_job_log_url_status(job_log_url["id"], "parsed")
