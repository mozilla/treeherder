import json
import logging
from cStringIO import StringIO
from itertools import islice

from django.conf import settings
from django.core.management.base import (BaseCommand,
                                         CommandError)
from django.db import transaction
from mozlog import reader

from treeherder.etl.common import fetch_text
from treeherder.log_parser.utils import expand_log_url
from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     Repository)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    args = '<repository>, <job_guid>, <log_url>'
    help = 'Download, parse and store the given failure summary log.'

    def handle(self, *args, **options):
        try:
            repository_name, job_guid, log_url = args
        except ValueError:
            raise CommandError('3 arguments required, %s given' % len(args))

        try:
            log_obj = expand_log_url(repository_name, job_guid, log_url)
        except ValueError:
            # This log_url either isn't in the database, or there are multiple possible
            # urls in the database, so we will be unable to update the pending state
            log_obj = None

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

        with transaction.atomic():
            FailureLine.objects.bulk_create(
                [FailureLine(repository=repository, job_guid=job_guid, **failure_line)
                 for failure_line in log_iter]
            )

        if log_obj is not None:
            with JobsModel(repository_name) as jm:
                log_obj = expand_log_url(repository_name, job_guid, log_url)
                jm.update_job_log_url_status(log_obj["id"], "parsed")
        else:
            logger.warning("Unable to set parsed state of job log")
