import logging
import re

from django.core.management.base import (BaseCommand,
                                         CommandError)
from mozlog.formatters.tbplformatter import TbplFormatter

from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)
from treeherder.model.models import (FailureLine,
                                     Repository,
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

        with ArtifactsModel(repository_name) as am:
            conditions = {
                'job_id': set([('=', job['id'])])
            }

            text_log_summary_conditions = conditions.copy()
            text_log_summary_conditions["name"] = set([("=", "text_log_summary")])
            text_log_summary = am.get_job_artifact_list(0, 1, text_log_summary_conditions)
            if not text_log_summary:
                logger.error("No text log summary generated for job")
                return
            text_log_summary = text_log_summary[0]

            bug_suggestions_conditions = conditions.copy()
            bug_suggestions_conditions["name"] = set([("=", "Bug suggestions")])
            bug_suggestions = am.get_job_artifact_list(0, 1, bug_suggestions_conditions)
            if not bug_suggestions:
                logger.error("No bug_suggestions generated for job")
                return
            bug_suggestions = bug_suggestions[0]

            self.crossreference_error_lines(repository, job_guid, failure_lines,
                                            text_log_summary, bug_suggestions)

    def crossreference_error_lines(self, repository, job_guid, failure_lines, text_log_summary,
                                   bug_suggestions):
        match_iter = structured_iterator(failure_lines)

        summary_lines = []

        failure_line, regexp = match_iter.next()

        summary, _ = TextLogSummary.objects.get_or_create(job_guid=job_guid,
                                                          repository=repository)
        summary.text_log_summary_artifact_id = text_log_summary["id"]
        summary.bug_suggestions_artifact_id = bug_suggestions["id"]

        summary.save()

        for error in text_log_summary["blob"]["step_data"]["all_errors"]:
            log_line = error["line"].strip()
            line_number = error["linenumber"]
            if regexp and regexp.match(log_line):
                logger.debug("Matched '%s'" % (log_line,))
                summary_lines.append(TextLogSummaryLine(summary=summary,
                                                        line_number=line_number,
                                                        failure_line=failure_line))
                failure_line, regexp = match_iter.next()
            else:
                logger.debug("Failed to match '%s'" % (log_line,))
                summary_lines.append(TextLogSummaryLine(summary=summary,
                                                        line_number=line_number,
                                                        failure_line=None))

        TextLogSummaryLine.objects.bulk_create(summary_lines)
        # We should have exhausted all structured lines
        for leftover in match_iter:
            # We can have a line without a pattern at the end if the log is truncated
            if leftover[1] is None:
                break
            logger.error("Failed to match structured line '%s' to an unstructured line" % (leftover[1].pattern,))


def structured_iterator(failure_lines):
    to_regexp = ErrorSummaryReConvertor()
    for failure_line in failure_lines:
        yield failure_line, to_regexp(failure_line)
    while True:
        yield None, None


class ErrorSummaryReConvertor(object):
    def __init__(self):
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
    rv = {"action": failure_line.action,
          "line_number": failure_line.line}
    for key in ["test", "subtest", "status", "expected", "message", "signature", "level",
                "stack", "stackwalk_stdout", "stackwalk_stderr"]:
        value = getattr(failure_line, key)
        if value is not None:
            rv[key] = value

    return rv
