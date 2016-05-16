import logging
from cStringIO import StringIO
from itertools import islice

from django.conf import settings
from django.core.management.base import (BaseCommand,
                                         CommandError)
from django.db import transaction
from mozlog import reader

from treeherder.etl.common import fetch_text
from treeherder.model.models import (FailureLine,
                                     JobLog,
                                     Repository)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    args = '<repository>, <job_guid>, <log_url>'
    help = 'Download, parse and store the given failure summary log.'

    def handle(self, *args, **options):
        try:
            repository_name, job_guid, job_log_url = args
        except ValueError:
            raise CommandError('3 arguments required, %s given' % len(args))

        try:
            log_obj = JobLog.objects.get(job__guid=job_guid,
                                         url=job_log_url)
        except JobLog.DoesNotExist:
            raise CommandError("Job log object with URL '%s' and guid '%s' "
                               "does not exist", job_log_url, job_guid)

        if log_obj.status == JobLog.PARSED:
            logger.debug("Log '%s' for guid '%s' already parsed, skipping",
                         job_log_url, job_guid)
            return

        log_text = fetch_text(job_log_url)

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

        with transaction.atomic():
            FailureLine.objects.bulk_create(
                [FailureLine(repository=repository, job_guid=job_guid, **failure_line)
                 for failure_line in log_iter]
            )

        log_obj.status == JobLog.PARSED
        log_obj.save()
