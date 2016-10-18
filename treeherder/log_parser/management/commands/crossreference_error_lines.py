import logging
import re

from django.core.management.base import (BaseCommand,
                                         CommandError)
from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     Repository,
                                     TextLogError,
                                     TextLogSummary,
                                     TextLogSummaryLine)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    args = '<repository>, <job_guid>'
    help = 'Download, parse and store the given failure summary log.'

    def handle(self, *args, **options):
        logger.debug("crossreference_error_lines command")
        if not len(args) == 2:
            raise CommandError('2 arguments required, %s given' % len(args))

        repository_name, job_guid = args

        try:
            repository = Repository.objects.get(name=repository_name, active_status='active')
        except Repository.DoesNotExist:
            raise CommandError('Unknown repository %s' % repository_name)

        failure_lines = FailureLine.objects.filter(repository=repository,
                                                   job_guid=job_guid)

        with JobsModel(repository_name) as jm:
            job = jm.get_job_ids_by_guid([job_guid]).get(job_guid)
            if job is None:
                logger.error('crossreference_error_lines: No job for '
                             '{0} job_guid {1}'.format(repository, job_guid))
                return

        text_log_errors = TextLogError.objects.filter(
            step__job__guid=job_guid).order_by('line_number')
        self.crossreference_error_lines(repository,
                                        job_guid,
                                        failure_lines,
                                        text_log_errors)

    def crossreference_error_lines(self, repository, job_guid, failure_lines,
                                   text_log_errors):
        """Populate the TextLogSummary and TextLogSummaryLine tables for a
        job. Specifically this function tries to match the
        unstructured error lines with the corresponding structured error lines, relying on
        the fact that serialization of mozlog (and hence errorsummary files) is determinisic
        so we can reserialize each structured error line and perform an in-order textual
        match.

        :param repository: Repository containing the job
        :param job_guid: guid for the job being crossreferenced
        :param failure_lines: List of FailureLine objects for this job
        :param text_log_errors: text log error lines for this job"""

        summary, _ = TextLogSummary.objects.get_or_create(job_guid=job_guid,
                                                          repository=repository)

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
