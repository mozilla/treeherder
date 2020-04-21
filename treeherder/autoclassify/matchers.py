import logging
from difflib import SequenceMatcher
from itertools import chain

import newrelic.agent
from django.db.models import Q

from treeherder.model.models import TextLogErrorMatch
from treeherder.utils.queryset import chunked_qs_reverse

from .utils import score_matches, time_boxed

logger = logging.getLogger(__name__)


@newrelic.agent.function_trace()
def precise_matcher(text_log_error):
    """Query for TextLogErrorMatches identical to matches of the given TextLogError."""
    failure_line = text_log_error.metadata.failure_line
    logger.debug("Looking for test match in failure %d", failure_line.id)

    if failure_line.action != "test_result" or failure_line.message is None:
        return

    f = {
        'text_log_error___metadata__failure_line__action': 'test_result',
        'text_log_error___metadata__failure_line__test': failure_line.test,
        'text_log_error___metadata__failure_line__subtest': failure_line.subtest,
        'text_log_error___metadata__failure_line__status': failure_line.status,
        'text_log_error___metadata__failure_line__expected': failure_line.expected,
        'text_log_error___metadata__failure_line__message': failure_line.message,
    }
    qwargs = Q(text_log_error___metadata__best_classification=None) & (
        Q(text_log_error___metadata__best_is_verified=True)
        | Q(text_log_error__step__job=text_log_error.step.job)
    )
    qs = (
        TextLogErrorMatch.objects.filter(**f)
        .exclude(qwargs)
        .order_by('-score', '-classified_failure')
    )

    if not qs:
        return

    # chunk through the QuerySet because it could potentially be very large
    # time bound each call to the scoring function to avoid job timeouts
    # returns an iterable of (score, classified_failure_id) tuples
    chunks = chunked_qs_reverse(qs, chunk_size=20000)
    return chain.from_iterable(time_boxed(score_matches, chunks, time_budget=500))


@newrelic.agent.function_trace()
def crash_signature_matcher(text_log_error):
    """
    Query for TextLogErrorMatches with the same crash signature.

    Produces two queries, first checking if the same test produces matches
    and secondly checking without the same test but lowering the produced
    scores.
    """
    failure_line = text_log_error.metadata.failure_line

    if (
        failure_line.action != "crash"
        or failure_line.signature is None
        or failure_line.signature == "None"
    ):
        return

    f = {
        'text_log_error___metadata__failure_line__action': 'crash',
        'text_log_error___metadata__failure_line__signature': failure_line.signature,
    }
    qwargs = Q(text_log_error___metadata__best_classification=None) & (
        Q(text_log_error___metadata__best_is_verified=True)
        | Q(text_log_error__step__job=text_log_error.step.job)
    )
    qs = (
        TextLogErrorMatch.objects.filter(**f)
        .exclude(qwargs)
        .select_related('text_log_error', 'text_log_error___metadata')
        .order_by('-score', '-classified_failure')
    )

    size = 20000
    time_budget = 500

    # See if we can get any matches when filtering by the same test
    first_attempt = qs.filter(text_log_error___metadata__failure_line__test=failure_line.test)
    chunks = chunked_qs_reverse(first_attempt, chunk_size=size)
    scored_matches = chain.from_iterable(time_boxed(score_matches, chunks, time_budget))
    if scored_matches:
        return scored_matches

    # try again without filtering to the test but applying a .8 score multiplyer
    chunks = chunked_qs_reverse(qs, chunk_size=size)
    scored_matches = chain.from_iterable(
        time_boxed(score_matches, chunks, time_budget, score_multiplier=(8, 10),)
    )
    return scored_matches


class MatchScorer:
    """Simple scorer for similarity of strings based on python's difflib SequenceMatcher."""

    def __init__(self, target):
        """:param target: The string to which candidate strings will be compared."""
        self.matcher = SequenceMatcher(lambda x: x == " ")
        self.matcher.set_seq2(target)

    def best_match(self, matches):
        """
        Find the most similar string to self.target.

        Given a list of candidate strings find the closest match to
        self.target, returning the best match with a score indicating closeness
        of match.

        :param matches: A list of candidate matches
        :returns: A tuple of (score, best_match)
        """
        best_match = None
        for match, message in matches:
            self.matcher.set_seq1(message)
            ratio = self.matcher.quick_ratio()
            if best_match is None or ratio >= best_match[0]:
                new_ratio = self.matcher.ratio()
                if best_match is None or new_ratio > best_match[0]:
                    best_match = (new_ratio, match)
        return best_match
