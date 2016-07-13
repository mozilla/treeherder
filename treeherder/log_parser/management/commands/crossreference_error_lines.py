import logging
import re

from django.core.management.base import (BaseCommand,
                                         CommandError)
from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.models import (FailureLine,
                                     Job,
                                     TextLogError)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    args = '<job_guid>'
    help = 'Crossreference structured failure lines with unstructured errors for job'

    def handle(self, *args, **options):
        logger.debug("crossreference_error_lines command")
        if not len(args) == 1:
            raise CommandError('1 arguments required, %s given' % len(args))

        job_guid = args[0]

        self.crossreference_error_lines(job_guid)

    def crossreference_error_lines(self, job_guid):
        """
        Match TextLogError objects with FailureLine objects for a job.

        Specifically this function tries to match the unstructured error lines
        with the corresponding structured error lines, relying on the fact that
        serialization of mozlog (and hence errorsummary files) is determinisic
        so we can reserialize each structured error line and perform an
        in-order textual match.

        :param repository: Repository containing the job
        :param job_guid: guid for the job being crossreferenced
        :param failure_lines: List of FailureLine objects for this job
        """
        job = Job.objects.get(guid=job_guid)
        failure_lines = FailureLine.objects.filter(job_guid=job_guid)

        match_iter = structured_iterator(failure_lines)
        failure_line, regexp = match_iter.next()

        # For each structured failure line, try to match it with an error
        # from the text log
        for error in TextLogError.objects.filter(
                job=job).order_by('line_number'):
            if regexp and regexp.match(error.line):
                logger.debug("Matched '%s'" % (error.line,))
                error.failure_line = failure_line
                error.save()
                failure_line, regexp = match_iter.next()

        # We should have exhausted all structured lines
        for leftover in match_iter:
            # We can have a line without a pattern at the end if the log is truncated
            if leftover[1] is None:
                break
            logger.error("Failed to match structured line '%s' to an unstructured line" % (leftover[1].pattern,))


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
