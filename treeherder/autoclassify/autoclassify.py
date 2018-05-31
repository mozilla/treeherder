# -*- coding: utf-8 -*-
import logging

from django.db.utils import IntegrityError
from first import first

from treeherder.model.models import (Job,
                                     JobNote,
                                     Matcher,
                                     TextLogError,
                                     TextLogErrorMatch)

logger = logging.getLogger(__name__)

# The minimum goodness of match we need to mark a particular match as the best match
AUTOCLASSIFY_CUTOFF_RATIO = 0.7
# A goodness of match after which we will not run further detectors
AUTOCLASSIFY_GOOD_ENOUGH_RATIO = 0.9


def match_errors(job, matchers=None):
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

    all_errors = set(TextLogError.objects.filter(step__job=job, classified_failures=None)
                                         .prefetch_related('step', '_metadata', '_metadata__failure_line'))
    errors = [t for t in all_errors if t.metadata and t.metadata.failure_line]

    if not errors:
        logger.info("Skipping autoclassify of job %i because it has no unmatched errors", job.id)
        return

    if matchers is None:
        matchers = Matcher.__subclasses__()

    try:
        matches = list(find_best_matches(errors, matchers))
        if not matches:
            return

        for matcher_name, match_tuple in matches:
            update_db(matcher_name, match_tuple)

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


def find_best_matches(errors, matchers):
    """
    Find the best match for each error

    We use the Good Enough™ ratio as a watershed level for match scores.
    """
    for text_log_error in errors:
        matches = find_all_matches(text_log_error, matchers)  # TextLogErrorMatch instances, unsaved!

        best_match = first(matches, key=lambda m: (-m.score, -m.classified_failure_id))
        if not best_match:
            continue

        yield best_match


def find_all_matches(text_log_error, matchers):
    """
    Find matches for the given error using the given matcher classes

    Returns *unsaved* TextLogErrorMatch instances.
    """
    for matcher_class in matchers:
        matcher = matcher_class()

        # matches: iterator of (score, ClassifiedFailure.id)
        matches = matcher.query_best(text_log_error)
        if not matches:
            continue

        for score, classified_failure_id in matches:
            yield TextLogErrorMatch(
                score=score,
                matcher_name=matcher.__class__.__name__,
                classified_failure_id=classified_failure_id,
                text_log_error=text_log_error,
            )

def update_db(matcher_name, match_tuple):
    text_log_error, classified_failure_id, score = match_tuple

    try:
        TextLogErrorMatch.create(
            classified_failure_id,
            matcher_name,
            score,
            text_log_error,
        )
    except IntegrityError:
        args = (text_log_error.id, matcher_name, classified_failure_id)
        logger.warning(
            "Tried to create duplicate match for TextLogError %i with matcher %s and classified_failure %i",
            args,
        )

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
