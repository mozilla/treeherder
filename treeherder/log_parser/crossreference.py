import logging
import re

from django.db import (IntegrityError,
                       transaction)
from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.models import (FailureLine,
                                     Job,
                                     TextLogError,
                                     TextLogErrorMetadata,
                                     TextLogSummary,
                                     TextLogSummaryLine)

logger = logging.getLogger(__name__)


def crossreference_job(job):
    """Populate the TextLogSummary and TextLogSummaryLine tables for a
    job. Specifically this function tries to match the
    unstructured error lines with the corresponding structured error lines, relying on
    the fact that serialization of mozlog (and hence errorsummary files) is determinisic
    so we can reserialize each structured error line and perform an in-order textual
    match.

    :job: - Job for which to perform the crossreferencing
    """

    try:
        if job.autoclassify_status >= Job.CROSSREFERENCED:
            logger.debug("Job %i already crossreferenced" % job.id)
            return (TextLogError.objects
                    .filter(step__job=job)
                    .exists() and
                    FailureLine.objects
                    .filter(job_guid=job.guid)
                    .exists())
        rv = _crossreference(job)
        job.autoclassify_status = Job.CROSSREFERENCED
        job.save(update_fields=['autoclassify_status'])
        return rv
    except IntegrityError:
        logger.warning("IntegrityError crossreferencing error lines for job %s" % job.id)
        return False


@transaction.atomic
def _crossreference(job):
    if TextLogSummary.objects.filter(job_guid=job.guid).exists():
        logger.info("crossreference_error_lines already ran for job %s" % job.id)
        return

    failure_lines = FailureLine.objects.filter(job_guid=job.guid)

    text_log_errors = TextLogError.objects.filter(
        step__job=job).order_by('line_number')

    # If we don't have both failure lines and text log errors nothing will happen
    # so return early
    if not (failure_lines.exists() and text_log_errors.exists()):
        return False

    summary = TextLogSummary.objects.create(job_guid=job.guid,
                                            repository=job.repository)

    match_iter = structured_iterator(failure_lines)
    failure_line, regexp = match_iter.next()

    summary_lines = []

    # For each error in the text log, try to match the next unmatched
    # structured log line
    for error in text_log_errors:
        if regexp and regexp.match(error.line.strip()):
            logger.debug("Matched '%s'" % (error.line,))
            summary_lines.append(TextLogSummaryLine(
                summary=summary,
                line_number=error.line_number,
                failure_line=failure_line))
            TextLogErrorMetadata.objects.create(text_log_error=error,
                                                failure_line=failure_line)
            failure_line, regexp = match_iter.next()
        else:
            logger.debug("Failed to match '%s'" % (error.line,))
            summary_lines.append(TextLogSummaryLine(
                summary=summary,
                line_number=error.line_number,
                failure_line=None))

    TextLogSummaryLine.objects.bulk_create(summary_lines)
    # We should have exhausted all structured lines
    for leftover in match_iter:
        # We can have a line without a pattern at the end if the log is truncated
        if leftover[1] is None:
            break
        logger.error("Failed to match structured line '%s' to an unstructured line" %
                     (leftover[1].pattern,))

    return bool(summary_lines)


def structured_iterator(failure_lines):
    """Map failure_lines to a (failure_line, regexp) iterator where the
    regexp will match an unstructured line corresponding to that structured line.

    :param failure_lines: Iterator of FailureLine objects
    """
    to_regexp = ErrorSummaryReConvertor()
    for failure_line in failure_lines:
        yield failure_line, to_regexp(failure_line)
    while True:
        yield None, None


class ErrorSummaryReConvertor(object):
    def __init__(self):
        """Stateful function for generating a regexp that matches TBPL formatted output
        corresponding to a specific FailureLine"""
        self._formatter = TbplFormatter()

    def __call__(self, failure_line):
        if failure_line.action == "test_result":
            action = "test_status" if failure_line.subtest is not None else "test_end"
        elif failure_line.action == "truncated":
            return None
        else:
            action = failure_line.action

        msg = getattr(self._formatter, action)(as_dict(failure_line)).split("\n", 1)[0]

        return re.compile(r".*%s$" % (re.escape(msg.strip())))


def as_dict(failure_line):
    """Convert a FailureLine into a dict in the format expected as input to
    mozlog formatters.

    :param failure_line: The FailureLine to convert."""
    rv = {"action": failure_line.action,
          "line_number": failure_line.line}
    for key in ["test", "subtest", "status", "expected", "message", "signature", "level",
                "stack", "stackwalk_stdout", "stackwalk_stderr"]:
        value = getattr(failure_line, key)
        if value is not None:
            rv[key] = value

    return rv
