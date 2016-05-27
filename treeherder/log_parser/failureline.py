import json
import logging
import re
from itertools import islice

from django.conf import settings
from django.db import transaction
from django.db.utils import OperationalError

from treeherder.etl.common import fetch_text
from treeherder.model.models import (FailureLine,
                                     JobLog,
                                     Repository)

logger = logging.getLogger(__name__)


def store_failure_lines(repository_name, job_guid, job_log):
    log_text = fetch_text(job_log.url)

    if not log_text:
        return

    log_iter = (json.loads(item) for item in log_text.splitlines())

    try:
        repository = Repository.objects.get(name=repository_name, active_status='active')
    except Repository.DoesNotExist:
        logger.error("Unknown repository %s" % repository_name)
        raise

    failure_lines_cutoff = settings.FAILURE_LINES_CUTOFF
    log_iter = list(islice(log_iter, failure_lines_cutoff+1))

    if len(log_iter) > failure_lines_cutoff:
        # Alter the N+1th log line to indicate the list was truncated.
        log_iter[-1].update(action='truncated')

    retry = False
    with transaction.atomic():
        try:
            create(repository, job_guid, job_log, log_iter)
        except OperationalError as e:
            logger.warning("Got OperationalError inserting failure_line")
            # Retry iff this error is the "incorrect String Value" error
            retry = e.args[0] == 1366

    logger.info("store failure lines 3")
    if retry:
        with transaction.atomic():
            logger.info("Retrying insert with astral character replacement")
            # Sometimes get an error if we can't save a string as MySQL pseudo-UTF8
            log_iter = list(replace_astral(log_iter))
            create(repository, job_guid, job_log, log_iter)


def create(repository, job_guid, job_log, log_iter):
    FailureLine.objects.bulk_create(
        [FailureLine(repository=repository, job_guid=job_guid, job_log=job_log,
                     **failure_line)
         for failure_line in log_iter]
    )
    job_log.status == JobLog.PARSED
    job_log.save()


def replace_astral(log_iter):
    for item in log_iter:
        for key in ["test", "subtest", "message", "stack", "stackwalk_stdout",
                    "stackwalk_stderr"]:
            if key in item:
                item[key] = astral_filter(item[key])
        yield item


# Regexp that matches all non-BMP unicode characters.
filter_re = re.compile(ur"([\U00010000-\U0010FFFF])", re.U)


def astral_filter(text):
    if text is None:
        return text
    return filter_re.sub(lambda x: "<U+%s>" % hex(ord(x.group(1)))[2:].zfill(6).upper(), text)
