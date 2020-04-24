import logging
from functools import partial

from django.db import IntegrityError, transaction
from first import first
from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.models import FailureLine, Job, TextLogError, TextLogErrorMetadata

logger = logging.getLogger(__name__)


def crossreference_job(job):
    """Try to match the unstructured error lines with the corresponding structured error
    lines, relying on the fact that serialization of mozlog (and hence errorsummary files)
    is determinisic so we can reserialize each structured error line and perform an in-order
    textual match.

    :job: - Job for which to perform the crossreferencing
    """
    logger.debug("Crossreference %s: started", job.id)

    if job.autoclassify_status >= Job.CROSSREFERENCED:
        logger.info("Job %i already crossreferenced", job.id)
        return False
    try:
        rv = _crossreference(job)
    except IntegrityError:
        job.autoclassify_status = Job.FAILED
        job.save(update_fields=['autoclassify_status'])
        logger.warning("IntegrityError crossreferencing error lines for job %s", job.id)
        return False

    job.autoclassify_status = Job.CROSSREFERENCED
    job.save(update_fields=['autoclassify_status'])
    return rv


@transaction.atomic
def _crossreference(job):
    failure_lines = FailureLine.objects.filter(job_guid=job.guid)
    text_log_errors = TextLogError.objects.filter(step__job=job).order_by('line_number')

    if not failure_lines and text_log_errors:
        return False

    match_iter = structured_iterator(failure_lines)
    failure_line, repr_str = next(match_iter)

    # For each error in the text log, try to match the next unmatched
    # structured log line
    for error in text_log_errors:
        if repr_str and error.line.strip().endswith(repr_str):
            logger.debug("Matched '%s'", error.line)
            TextLogErrorMetadata.objects.get_or_create(
                text_log_error=error, failure_line=failure_line
            )
            failure_line, repr_str = next(match_iter)
        else:
            logger.debug("Failed to match '%s'", error.line)

    # We should have exhausted all structured lines
    for failure_line, repr_str in match_iter:
        # We can have a line without a pattern at the end if the log is truncated
        if failure_line is None:
            break
        logger.warning(
            "Crossreference %s: Failed to match structured line '%s' to an unstructured line",
            job.id,
            repr_str,
        )

    return True


def structured_iterator(failure_lines):
    """Create FailureLine, Tbpl-formatted-string tuples."""
    summary = partial(failure_line_summary, TbplFormatter())
    for failure_line in failure_lines:
        repr_str = summary(failure_line)
        if repr_str:
            yield failure_line, repr_str

    while True:
        yield None, None


def failure_line_summary(formatter, failure_line):
    """
    Create a mozlog formatted error summary string from the given failure_line.

    Create a string which can be compared to a TextLogError.line string to see
    if they match.
    """
    if failure_line.action == "test_result":
        action = "test_status" if failure_line.subtest is not None else "test_end"
    elif failure_line.action in ["test_groups", "truncated"]:
        return
    else:
        action = failure_line.action

    try:
        mozlog_func = getattr(formatter, action)
    except AttributeError:
        logger.warning('Unknown mozlog function "%s"', action)
        return

    formatted_log = mozlog_func(failure_line.to_mozlog_format())
    split_log = first(formatted_log.split("\n", 1))

    if not split_log:
        logger.debug('Failed to split log', formatted_log)
        return

    return split_log.strip()
