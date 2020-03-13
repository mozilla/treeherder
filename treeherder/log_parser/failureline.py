import json
import logging
from itertools import islice

import newrelic.agent
from django.conf import settings
from django.db import transaction
from django.db.utils import (IntegrityError,
                             OperationalError)
from requests.exceptions import HTTPError

from treeherder.etl.text import astral_filter
from treeherder.model.models import (FailureLine,
                                     Group,
                                     JobLog)
from treeherder.utils.http import fetch_text

logger = logging.getLogger(__name__)


def store_failure_lines(job_log):
    log_iter = fetch_log(job_log)
    if not log_iter:
        return False
    return write_failure_lines(job_log, log_iter)


def fetch_log(job_log):
    try:
        log_text = fetch_text(job_log.url)
    except HTTPError as e:
        job_log.update_status(JobLog.FAILED)
        if e.response is not None and e.response.status_code in (403, 404):
            logger.warning("Unable to retrieve log for %s: %s",
                           job_log.url, e)
            return
        raise

    if not log_text:
        return

    return (json.loads(item) for item in log_text.splitlines())


def write_failure_lines(job_log, log_iter):
    failure_lines_cutoff = settings.FAILURE_LINES_CUTOFF
    log_list = list(islice(log_iter, failure_lines_cutoff+1))

    if len(log_list) > failure_lines_cutoff:
        # Alter the N+1th log line to indicate the list was truncated.
        log_list[-1].update(action='truncated')

    transformer = None
    with transaction.atomic():
        try:
            failure_lines = create(job_log, log_list)
        except OperationalError as e:
            logger.warning("Got OperationalError inserting failure_line")
            # Retry iff this error is the "incorrect String Value" error
            if e.args[0] == 1366:
                # Sometimes get an error if we can't save a string as MySQL pseudo-UTF8
                transformer = replace_astral
            else:
                raise
        except IntegrityError:
            logger.warning("Got IntegrityError inserting failure_line")

            def exclude_lines(log_list):
                exclude = set(
                    FailureLine.objects.filter(job_log=job_log,
                                               line__in=[item["line"] for item in log_list])
                    .values_list("line", flat=True))
                return (item for item in log_list if item["line"] not in exclude)

            transformer = exclude_lines

    # If we hit an error that might be solved by transofrming the data then retry
    if transformer is not None:
        with transaction.atomic():
            log_list = list(transformer(log_list))
            failure_lines = create(job_log, log_list)

    return failure_lines


_failure_line_keys = ["action", "line", "test", "subtest", "status",
                      "expected", "message", "signature", "level",
                      "stack", "stackwalk_stdout", "stackwalk_stderr"]


def get_kwargs(failure_line):
    return {key: failure_line[key] for key in _failure_line_keys
            if key in failure_line}


def create_failure_line(job_log, failure_line):
    fl = FailureLine.objects.create(repository=job_log.job.repository,
                                    job_guid=job_log.job.guid,
                                    job_log=job_log,
                                    **get_kwargs(failure_line))
    if "group" in failure_line:
        # Omit the filename before storing.
        group_path = failure_line["group"].rsplit("/", 1)[0]

        # Log to New Relic if it's not in a form we like.  We can enter
        # Bugs to upstream to remedy them.
        if "\\" in group_path or ":" in group_path or len(group_path) > 255:
            newrelic.agent.record_custom_event(
                "malformed_test_group",
                {"message": "Group paths must be relative, with no backslashes and <255 chars",
                 "group": failure_line["group"],
                 "group_path": group_path,
                 "length": len(group_path),
                 "repository": fl.repository,
                 "job_guid": fl.job_guid,
                 "failure_line_id": fl.id
                 })

        # Save the value regardless
        group, _ = Group.objects.get_or_create(name=group_path[:255])
        group.failure_lines.add(fl)

    return fl


def create(job_log, log_list):
    failure_lines = [create_failure_line(job_log, failure_line)
                     for failure_line in log_list]
    job_log.update_status(JobLog.PARSED)
    return failure_lines


def replace_astral(log_list):
    for item in log_list:
        for key in ["test", "subtest", "message", "stack", "stackwalk_stdout",
                    "stackwalk_stderr"]:
            if key in item:
                item[key] = astral_filter(item[key])
        yield item
