import logging
from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError

from treeherder.autostar import matchers
from treeherder.model.models import FailureLine, Matcher, FailureMatch

logger = logging.getLogger(__name__)

# The minimum goodness of match we need to mark a particular match as the best match
AUTOSTAR_CUTOFF_RATIO = 0.8

# Initialisation needed to associate matcher functions with the matcher objects
matchers.register()


class Command(BaseCommand):
    args = '<job_guid>, <repository>'
    help = 'Mark failures on a job.'

    def handle(self, *args, **options):

        if not len(args) == 2:
            raise CommandError('3 arguments required, %s given' % len(args))
        job_id, repository = args

        match_errors(repository, job_id)


def match_errors(repository, job_guid):
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
        best_match = failure_line.best_match(AUTOSTAR_CUTOFF_RATIO)
        if best_match:
            best_match.is_best = True
            best_match.save()


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
