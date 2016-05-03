import json
import logging
import re
from itertools import islice

from django.conf import settings
from django.db import transaction
from django.db.utils import OperationalError
from requests.exceptions import HTTPError

from treeherder.etl.common import fetch_text
from treeherder.model.models import (FailureLine,
                                     JobLog,
                                     Repository)
from treeherder.model.search import (TestFailureLine,
                                     bulk_insert)

logger = logging.getLogger(__name__)


def store_failure_lines(repository_name, job_guid, job_log):
    try:
        log_text = fetch_text(job_log.url)
    except HTTPError as e:
        job_log.status = JobLog.FAILED
        job_log.save()
        if e.response is not None and e.response.status_code in (403, 404):
            logger.warning("Unable to retrieve log for %s: %s",
                           job_log.url, e)
            return
        raise

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
            failure_lines = create(repository, job_guid, job_log, log_iter)
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
            failure_lines = create(repository, job_guid, job_log, log_iter)

    create_es(failure_lines)


def create(repository, job_guid, job_log, log_iter):
    failure_lines = [
        FailureLine.objects.create(repository=repository, job_guid=job_guid, job_log=job_log,
                                   **failure_line)
        for failure_line in log_iter]

    job_log.status == JobLog.PARSED
    job_log.save()
    return failure_lines


def create_es(failure_lines):
    # Store the failure lines in elastic_search
    es_lines = []
    for failure_line in failure_lines:
        es_line = TestFailureLine.from_model(failure_line)
        if es_line:
            es_lines.append(es_line)
    bulk_insert(es_lines)


def replace_astral(log_iter):
    for item in log_iter:
        for key in ["test", "subtest", "message", "stack", "stackwalk_stdout",
                    "stackwalk_stderr"]:
            if key in item:
                item[key] = astral_filter(item[key])
        yield item


def char_to_codepoint_ucs4(x):
    return ord(x)


def char_to_codepoint_ucs2(x):
    return (0x10000 + (ord(x[0]) - 0xD800) * 0x400 +
            (ord(x[1]) - 0xDC00))


# Regexp that matches all non-BMP unicode characters.
if len(u"\U0010FFFF") == 1:
    filter_re = re.compile(ur"([\U00010000-\U0010FFFF])", re.U)
    char_to_codepoint = char_to_codepoint_ucs4
else:
    # Python is compiled as the UCS2 variant so we have to match two
    # bytes in a surrogate pair. Then we have to decode the two bytes
    # according to UTF16 rules to get a single codepoint
    filter_re = re.compile(ur"([\uD800-\uDBFF][\uDC00-\uDFFF])", re.U)
    char_to_codepoint = char_to_codepoint_ucs2


def astral_filter(text):
    if text is None:
        return text
    return filter_re.sub(lambda x: "<U+%s>" % hex(char_to_codepoint(x.group(0)))[2:].zfill(6).upper(), text)
