import logging

from django.db.utils import IntegrityError

from treeherder.model.models import (FailureMatch,
                                     Job,
                                     JobNote,
                                     Matcher,
                                     TextLogError,
                                     TextLogErrorMatch)

logger = logging.getLogger(__name__)

# The minimum goodness of match we need to mark a particular match as the best match
AUTOCLASSIFY_CUTOFF_RATIO = 0.7
# A goodness of match after which we will not run further detectors
AUTOCLASSIFY_GOOD_ENOUGH_RATIO = 0.9


def match_errors(job):
    # Only try to autoclassify where we have a failure status; sometimes there can be
    # error lines even in jobs marked as passing.

    if job.autoclassify_status < Job.CROSSREFERENCED:
        logger.error("Tried to autoclassify job %i without crossreferenced error lines", job.id)
        return

    if job.autoclassify_status == Job.AUTOCLASSIFIED:
        logger.error("Tried to autoclassify job %i which was already autoclassified", job.id)
        return

    if job.result not in ["testfailed", "busted", "exception"]:
        return

    unmatched_errors = set(TextLogError.objects.filter(step__job=job, classified_failures=None)
                                               .prefetch_related('step', '_metadata', '_metadata__failure_line'))

    if not unmatched_errors:
        logger.info("Skipping autoclassify of job %i because it has no unmatched errors", job.id)
        return

    try:
        matches, all_matched = find_matches(unmatched_errors)
        update_db(matches)
        create_note(job, all_matched)
    except Exception:
        logger.error("Autoclassification of job %s failed", job.id)
        job.autoclassify_status = Job.FAILED
        raise
    else:
        logger.debug("Autoclassification of job %s suceeded", job.id)
        job.autoclassify_status = Job.AUTOCLASSIFIED
    finally:
        job.save(update_fields=['autoclassify_status'])


def find_matches(unmatched_errors):
    all_matches = set()

    for matcher in Matcher.objects.registered_matchers():
        matches = matcher(unmatched_errors)
        # matches: generator of Match tuples: (TextLogError, ClassifiedFailure.id, score)
        for match in matches:
            logger.info("Matched error %i with intermittent %i",
                        match.text_log_error.id, match.classified_failure_id)
            all_matches.add((matcher.db_object, match))
            if match.score >= AUTOCLASSIFY_GOOD_ENOUGH_RATIO:
                unmatched_errors.remove(match.text_log_error)

        if not unmatched_errors:
            break

    return all_matches, len(unmatched_errors) == 0


def update_db(matches):
    for matcher, match_tuple in matches:
        text_log_error, classified_failure_id, score = match_tuple

        try:
            TextLogErrorMatch.objects.create(
                score=score,
                matcher=matcher,
                classified_failure_id=classified_failure_id,
                text_log_error=text_log_error,
            )

            if text_log_error.metadata and text_log_error.metadata.failure_line:
                FailureMatch.objects.create(
                    score=score,
                    matcher=matcher,
                    classified_failure_id=classified_failure_id,
                    failure_line=text_log_error.metadata.failure_line
                )
        except IntegrityError:
            logger.warning(
                "Tried to create duplicate match for TextLogError %i with matcher %i and classified_failure %i",
                text_log_error.id, matcher.id, classified_failure_id)

        best_match = text_log_error.best_automatic_match(AUTOCLASSIFY_CUTOFF_RATIO)
        if best_match:
            text_log_error.mark_best_classification(classified_failure_id)


def create_note(job, all_matched):
    if not (all_matched and job.is_fully_autoclassified()):
        return

    # We don't want to add a job note after an autoclassification if there is
    # already one and after a verification if there is already one not supplied
    # by the autoclassifier
    if not JobNote.objects.filter(job=job).exists():
        JobNote.create_autoclassify_job_note(job)
