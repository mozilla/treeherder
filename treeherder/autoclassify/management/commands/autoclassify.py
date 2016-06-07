import logging
from collections import defaultdict

from django.core.management.base import (BaseCommand,
                                         CommandError)
from django.db.utils import IntegrityError

from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     FailureMatch,
                                     Matcher)

logger = logging.getLogger(__name__)

# The minimum goodness of match we need to mark a particular match as the best match
AUTOCLASSIFY_CUTOFF_RATIO = 0.7
# A goodness of match after which we will not run further detectors
AUTOCLASSIFY_GOOD_ENOUGH_RATIO = 0.9


class Command(BaseCommand):
    args = '<job_guid>, <repository>'
    help = 'Mark failures on a job.'

    def handle(self, *args, **options):

        if not len(args) == 2:
            raise CommandError('2 arguments required, %s given' % len(args))
        repository, job_guid = args

        with JobsModel(repository) as jm:
            match_errors(repository, jm, job_guid)


def match_errors(repository, jm, job_guid):
    job = jm.get_job_ids_by_guid([job_guid]).get(job_guid)

    if not job:
        logger.error('autoclassify: No job for '
                     '{0} job_guid {1}'.format(repository, job_guid))
        return

    job_id = job.get("id")

    # Only try to autoclassify where we have a failure status; sometimes there can be
    # error lines even in jobs marked as passing.
    if job["result"] not in ["testfailed", "busted", "exception"]:
        return

    unmatched_failures = set(FailureLine.objects.unmatched_for_job(repository, job_guid))

    if not unmatched_failures:
        return

    matches, all_matched = find_matches(unmatched_failures)
    update_db(jm, job_id, matches, all_matched)


def find_matches(unmatched_failures):
    all_matches = set()

    for matcher in Matcher.objects.registered_matchers():
        matches = matcher(unmatched_failures)
        for match in matches:
            logger.info("Matched failure %i with intermittent %i" %
                        (match.failure_line.id, match.classified_failure.id))
            all_matches.add((matcher.db_object, match))
            if match.score >= AUTOCLASSIFY_GOOD_ENOUGH_RATIO:
                unmatched_failures.remove(match.failure_line)

        if not unmatched_failures:
            break

    return all_matches, len(unmatched_failures) == 0


def update_db(jm, job_id, matches, all_matched):
    matches_by_failure_line = defaultdict(set)
    for item in matches:
        matches_by_failure_line[item[1].failure_line].add(item)

    for failure_line, matches in matches_by_failure_line.iteritems():
        for matcher, match in matches:
            try:
                FailureMatch.objects.create(
                    score=match.score,
                    matcher=matcher,
                    classified_failure=match.classified_failure,
                    failure_line=failure_line)
            except IntegrityError:
                logger.warning(
                    "Tried to create duplicate match for failure line %i with matcher %i and classified_failure %i" %
                    (failure_line.id, matcher.id, match.classified_failure.id))
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
