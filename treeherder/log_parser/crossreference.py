import logging

from django.db import (IntegrityError,
                       transaction)
from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.models import (FailureLine,
                                     Job,
                                     TextLogError,
                                     TextLogErrorMetadata)

logger = logging.getLogger(__name__)


def crossreference_job(job):
    """Try to match the unstructured error lines with the corresponding structured error
    lines, relying on the fact that serialization of mozlog (and hence errorsummary files)
    is determinisic so we can reserialize each structured error line and perform an in-order
    textual match.

    :job: - Job for which to perform the crossreferencing
    """

    if job.autoclassify_status >= Job.CROSSREFERENCED:
        logger.info("Job %i already crossreferenced" % job.id)
        return False
    try:
        rv = _crossreference(job)
    except IntegrityError:
        job.autoclassify_status = Job.FAILED
        job.save(update_fields=['autoclassify_status'])
        logger.warning("IntegrityError crossreferencing error lines for job %s" % job.id)
        return False

    job.autoclassify_status = Job.CROSSREFERENCED
    job.save(update_fields=['autoclassify_status'])
    return rv


@transaction.atomic
def _crossreference(job):
    failure_lines = FailureLine.objects.filter(job_guid=job.guid)

    text_log_errors = TextLogError.objects.filter(
        step__job=job).order_by('line_number')

    # If we don't have both failure lines and text log errors this will never succeed
    if not (failure_lines.exists() and text_log_errors.exists()):
        return False

    match_iter = structured_iterator(list(failure_lines.all()))
    failure_line, _, fn = match_iter.next()

    # For each error in the text log, try to match the next unmatched
    # structured log line
    for error in list(text_log_errors.all()):
        if fn and fn(error.line.strip()):
            logger.debug("Matched '%s'" % (error.line,))
            TextLogErrorMetadata.objects.get_or_create(text_log_error=error,
                                                       failure_line=failure_line)
            failure_line, _, fn = match_iter.next()
        else:
            logger.debug("Failed to match '%s'" % (error.line,))

    # We should have exhausted all structured lines
    for failure_line, repr_str, _ in match_iter:
        # We can have a line without a pattern at the end if the log is truncated
        if failure_line is None:
            break
        logger.warning("Crossreference %s: Failed to match structured line '%s' to an unstructured line" %
                       (job.id, repr_str))

    return True


def structured_iterator(failure_lines):
    """Map failure_lines to a (failure_line, regexp) iterator where the
    regexp will match an unstructured line corresponding to that structured line.

    :param failure_lines: Iterator of FailureLine objects
    """
    to_fn = ErrorSummaryMatchConvertor()
    for failure_line in failure_lines:
        repr_str, fn = to_fn(failure_line)
        if fn:
            yield failure_line, repr_str, fn
    while True:
        yield None, None, None


class ErrorSummaryMatchConvertor(object):
    def __init__(self):
        """Stateful function for generating a regexp that matches TBPL formatted output
        corresponding to a specific FailureLine"""
        self._formatter = TbplFormatter()

    def __call__(self, failure_line):
        if failure_line.action == "test_result":
            action = "test_status" if failure_line.subtest is not None else "test_end"
        elif failure_line.action == "truncated":
            return None, None
        else:
            action = failure_line.action

        try:
            f = getattr(self._formatter, action)
        except AttributeError:
            return None, None

        msg = f(as_dict(failure_line)).split("\n", 1)[0]

        return msg, lambda x: x.endswith(msg.strip())


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
