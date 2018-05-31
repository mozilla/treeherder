from __future__ import division

import logging
from abc import (ABCMeta,
                 abstractmethod)
from difflib import SequenceMatcher
from itertools import chain

import newrelic.agent
from django.conf import settings
from django.db.models import Q
from six import add_metaclass

from treeherder.model.models import TextLogErrorMatch
from treeherder.services.elasticsearch import search
from treeherder.utils.queryset import chunked_qs_reverse

from .utils import (score_matches,
                    time_boxed)

logger = logging.getLogger(__name__)


@add_metaclass(ABCMeta)
class Matcher(object):
    """Parent class for Matchers, providing the interface for query_best"""
    @abstractmethod
    def query_best(self, text_log_error):
        """All child classes must implement this method."""
        pass


class PreciseTestMatcher(Matcher):
    """Matcher that looks for existing failures with identical tests and identical error message."""
    @newrelic.agent.function_trace()
    def query_best(self, text_log_error):
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
            'text_log_error___metadata__failure_line__message': failure_line.message
        }
        qwargs = (
            Q(text_log_error___metadata__best_classification=None)
            & (Q(text_log_error___metadata__best_is_verified=True)
               | Q(text_log_error__step__job=text_log_error.step.job))
        )
        qs = (TextLogErrorMatch.objects.filter(**f)
                                       .exclude(qwargs)
                                       .order_by('-score', '-classified_failure'))

        if not qs:
            return

        # chunk through the QuerySet because it could potentially be very large
        # time bound each call to the scoring function to avoid job timeouts
        # returns an iterable of (score, classified_failure_id) tuples
        chunks = chunked_qs_reverse(qs, chunk_size=20000)
        return chain.from_iterable(time_boxed(score_matches, chunks, time_budget=500))


class ElasticSearchTestMatcher(Matcher):
    """Looks for existing failures using Elasticsearch."""
    @newrelic.agent.function_trace()
    def query_best(self, text_log_error):
        """
        Query Elasticsearch and score the results.

        Uses a filtered search checking test, status, expected, and the message
        as a phrase query with non-alphabet tokens removed.
        """
        if not settings.ELASTICSEARCH_URL:
            return []

        failure_line = text_log_error.metadata.failure_line

        if failure_line.action != "test_result" or not failure_line.message:
            logger.debug("Skipped elasticsearch matching")
            return

        filters = [
            {'term': {'test': failure_line.test}},
            {'term': {'status': failure_line.status}},
            {'term': {'expected': failure_line.expected}},
            {'exists': {'field': 'best_classification'}}
        ]
        if failure_line.subtest:
            query = filters.append({'term': {'subtest': failure_line.subtest}})

        query = {
            'query': {
                'bool': {
                    'filter': filters,
                    'must': [{
                        'match_phrase': {
                            'message': failure_line.message[:1024],
                        },
                    }],
                },
            },
        }

        try:
            results = search(query)
        except Exception:
            logger.error("Elasticsearch lookup failed: %s %s %s %s %s",
                         failure_line.test, failure_line.subtest, failure_line.status,
                         failure_line.expected, failure_line.message)
            raise

        if len(results) > 1:
            args = (
                text_log_error.id,
                failure_line.id,
                len(results),
            )
            logger.info('text_log_error=%i failure_line=%i Elasticsearch produced %i results' % args)
            newrelic.agent.record_custom_event('es_matches', {
                'num_results': len(results),
                'text_log_error_id': text_log_error.id,
                'failure_line_id': failure_line.id,
            })

        scorer = MatchScorer(failure_line.message)
        matches = [(item, item['message']) for item in results]
        best_match = scorer.best_match(matches)
        if not best_match:
            return

        score, es_result = best_match
        # TODO: score all results and return
        # TODO: just return results with score above cut off?
        return [(score, es_result['best_classification'])]


class CrashSignatureMatcher(Matcher):
    """Matcher that looks for crashes with identical signature."""
    @newrelic.agent.function_trace()
    def query_best(self, text_log_error):
        """
        Query for TextLogErrorMatches with the same crash signature.

        Produces two queries, first checking if the same test produces matches
        and secondly checking without the same test but lowering the produced
        scores.
        """
        failure_line = text_log_error.metadata.failure_line

        if (failure_line.action != "crash" or
            failure_line.signature is None or
            failure_line.signature == "None"):
            return

        f = {
            'text_log_error___metadata__failure_line__action': 'crash',
            'text_log_error___metadata__failure_line__signature': failure_line.signature,
        }
        qwargs = (
            Q(text_log_error___metadata__best_classification=None)
            & (Q(text_log_error___metadata__best_is_verified=True)
               | Q(text_log_error__step__job=text_log_error.step.job))
        )
        qs = (TextLogErrorMatch.objects.filter(**f)
                                       .exclude(qwargs)
                                       .select_related('text_log_error', 'text_log_error___metadata')
                                       .order_by('-score', '-classified_failure'))

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
        scored_matches = chain.from_iterable(time_boxed(
            score_matches,
            chunks,
            time_budget,
            score_multiplier=(8, 10),
        ))
        return scored_matches


class MatchScorer(object):
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
