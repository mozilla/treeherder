import logging
from collections import defaultdict

from django.db.utils import IntegrityError

from treeherder.model.models import (ClassifiedFailure,
                                     FailureMatch,
                                     Job,
                                     JobNote,
                                     Matcher,
                                     TextLogError,
                                     TextLogErrorMatch)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
logging.basicConfig()


# The minimum goodness of match we need to mark a particular match as the best match
AUTOCLASSIFY_CUTOFF_RATIO = 0.7
# A goodness of match after which we will not run further detectors
AUTOCLASSIFY_GOOD_ENOUGH_RATIO = 0.9


def match_errors(job):
    # Only try to autoclassify where we have a failure status; sometimes there can be
    # error lines even in jobs marked as passing.

    if job.autoclassify_status < Job.CROSSREFERENCED:
        logger.error("Tried to autoclassify job %i without crossreferenced error lines" % job.id)
        return

    if job.autoclassify_status == Job.AUTOCLASSIFIED:
        logger.error("Tried to autoclassify job %i which was already autoclassified" % job.id)
        return

    if job.result not in ["testfailed", "busted", "exception"]:
        return

    unmatched_errors = set(TextLogError.objects.unmatched_for_job(job))

    if not unmatched_errors:
        logger.info("Skipping autoclassify of job %i because it has no unmatched errors" % job.id)
        return

    try:
        matches, all_matched = find_matches(unmatched_errors)
        update_db(job, matches, all_matched)
    except:
        logger.error("Autoclassification of job %s failed" % job.id)
        job.autoclassify_status = Job.FAILED
        raise
    else:
        logger.debug("Autoclassification of job %s suceeded" % job.id)
        job.autoclassify_status = Job.AUTOCLASSIFIED
    finally:
        job.save(update_fields=['autoclassify_status'])


def find_matches(unmatched_errors):
    all_matches = set()

    for matcher in Matcher.objects.registered_matchers():
        matches = matcher(unmatched_errors)
        for match in matches:
            logger.info("Matched error %i with intermittent %i" %
                        (match.text_log_error.id, match.classified_failure_id))
            all_matches.add((matcher.db_object, match))
            if match.score >= AUTOCLASSIFY_GOOD_ENOUGH_RATIO:
                unmatched_errors.remove(match.text_log_error)

        if not unmatched_errors:
            break

    return all_matches, len(unmatched_errors) == 0


def update_db(job, matches, all_matched):
    matches_by_error = defaultdict(set)
    classified_failures = {item.id: item for item in
                           ClassifiedFailure.objects.filter(
                               id__in=[match.classified_failure_id for _, match in matches])}
    for matcher, match in matches:
        classified_failure = classified_failures[match.classified_failure_id]
        matches_by_error[match.text_log_error].add((matcher, match, classified_failure))

    for text_log_error, matches in matches_by_error.iteritems():
        for (matcher, match, classified_failure) in matches:
            try:
                TextLogErrorMatch.objects.create(
                    score=match.score,
                    matcher=matcher,
                    classified_failure=classified_failure,
                    text_log_error=match.text_log_error)
                if match.text_log_error.failure_line:
                    FailureMatch.objects.create(
                        score=match.score,
                        matcher=matcher,
                        classified_failure=classified_failure,
                        failure_line=match.text_log_error.failure_line)
            except IntegrityError:
                logger.warning(
                    "Tried to create duplicate match for TextLogError %i with matcher %i and classified_failure %i" %
                    (text_log_error.id, matcher.id, classified_failure.id))
        best_match = text_log_error.best_automatic_match(AUTOCLASSIFY_CUTOFF_RATIO)
        if best_match:
            text_log_error.mark_best_classification(classified_failure)

    if all_matched:
        if job.is_fully_autoclassified():
            # We don't want to add a job note after an autoclassification if there is already
            # one and after a verification if there is already one not supplied by the
            # autoclassifier
            if not JobNote.objects.filter(job=job).exists():
                JobNote.objects.create_autoclassify_job_note(job)
