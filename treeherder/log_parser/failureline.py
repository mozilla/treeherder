import logging
from cStringIO import StringIO
from itertools import islice

from django.conf import settings
from django.db import transaction
from mozlog import reader

from treeherder.etl.common import fetch_text
from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     Repository)

logger = logging.getLogger(__name__)


def store_failure_lines(repository_name, job_guid, log_obj):
    log_id = log_obj["id"]
    log_text = fetch_text(log_obj["url"])

    if not log_text:
        return

    log_content = StringIO(log_text)

    try:
        repository = Repository.objects.get(name=repository_name, active_status='active')
    except Repository.DoesNotExist:
        logger.error("Unknown repository %s" % repository_name)
        raise

    log_iter = reader.read(log_content)

    failure_lines_cutoff = settings.FAILURE_LINES_CUTOFF
    log_iter = list(islice(log_iter, failure_lines_cutoff+1))

    if len(log_iter) > failure_lines_cutoff:
        # Alter the N+1th log line to indicate the list was truncated.
        log_iter[-1].update(action='truncated')

    with transaction.atomic():
        FailureLine.objects.bulk_create(
            [FailureLine(project_log_id=log_id, repository=repository, job_guid=job_guid,
                         **failure_line)
             for failure_line in log_iter]
        )

    with JobsModel(repository_name) as jm:
        jm.update_job_log_url_status(log_id, "parsed")
