import logging
from collections import defaultdict

from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     FailureMatch,
                                     Matcher)

logger = logging.getLogger(__name__)

# The minimum goodness of match we need to mark a particular match as the best match
AUTOCLASSIFY_CUTOFF_RATIO = 0.8


class Command(BaseCommand):
    args = '<job_guid>, <repository>'
    help = 'Mark failures on a job.'

    def handle(self, *args, **options):

        if not len(args) == 2:
            raise CommandError('3 arguments required, %s given' % len(args))
        job_guid, repository = args

        with JobsModel(repository) as jm:
            match_errors(repository, jm, job_guid)


def match_errors(repository, jm, job_guid):
    job_id = jm.get_job_ids_by_guid([job_guid])[job_guid]["id"]
    job = jm.get_job(job_id)[0]

    # Only try to autoclassify where we have a failure status; sometimes there can be
    # error lines even in jobs marked as passing.
    if job["result"] not in ["testfailed", "busted", "exception"]:
        return

    unmatched_failures = FailureLine.objects.unmatched_for_job(repository, job_guid)

    if not unmatched_failures:
        return

    all_matched = set()

    for matcher in Matcher.objects.registered_matchers():
        matches = matcher(unmatched_failures)
        for match in matches:
            match.failure_line.matches.add(
                FailureMatch(score=match.score,
                             matcher=matcher.db_object,
                             classified_failure=match.classified_failure))
            match.failure_line.save()
            logger.info("Matched failure %i with intermittent %i" %
                        (match.failure_line.id, match.classified_failure.id))
            all_matched.add(match.failure_line)

        if all_lines_matched(unmatched_failures):
            break

    for failure_line in all_matched:
        # TODO: store all matches
        best_match = failure_line.best_automatic_match(AUTOCLASSIFY_CUTOFF_RATIO)
        if best_match:
            failure_line.best_classification = best_match.classified_failure
            failure_line.save()

    if all_matched:
        jm.update_after_autoclassification(job_id)


def all_lines_matched(failure_lines):
    failure_score_dict = defaultdict(list)

    query = FailureMatch.objects.filter(
        failure_line__in=failure_lines).only('failure_line_id', 'score')

    for failure_match in query:
        failure_score_dict[failure_match.failure_line_id].append(failure_match.score)

    for failure_line in failure_lines:
        scores = failure_score_dict[failure_line.id]
        if not scores or not all(score >= 1 for score in scores):
            return False
    return True
