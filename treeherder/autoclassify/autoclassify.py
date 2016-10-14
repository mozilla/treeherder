import logging
from collections import defaultdict

from django.db.utils import IntegrityError

from treeherder.model.derived import JobsModel
from treeherder.model.models import (FailureLine,
                                     FailureMatch,
                                     JobNote,
                                     Matcher)

logger = logging.getLogger(__name__)

# The minimum goodness of match we need to mark a particular match as the best match
AUTOCLASSIFY_CUTOFF_RATIO = 0.7
# A goodness of match after which we will not run further detectors
AUTOCLASSIFY_GOOD_ENOUGH_RATIO = 0.9


def match_errors(job):
    # Only try to autoclassify where we have a failure status; sometimes there can be
    # error lines even in jobs marked as passing.

    with JobsModel(job.repository.name) as jm:
        ds_job = jm.get_job(job.project_specific_id)[0]
        if ds_job["result"] not in ["testfailed", "busted", "exception"]:
            return

    unmatched_failures = set(FailureLine.objects.unmatched_for_job(job))

    if not unmatched_failures:
        return

    matches, all_matched = find_matches(unmatched_failures)
    update_db(job, matches, all_matched)


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


def update_db(job, matches, all_matched):
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
        if job.is_fully_autoclassified():
            # We don't want to add a job note after an autoclassification if there is already
            # one and after a verification if there is already one not supplied by the
            # autoclassifier
            if not JobNote.objects.filter(job=job).exists():
                JobNote.objects.create_autoclassify_job_note(job)
