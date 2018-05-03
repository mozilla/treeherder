# -*- coding: utf-8 -*-
from __future__ import division

import logging
import time
from abc import (ABCMeta,
                 abstractmethod)
from collections import namedtuple
from difflib import SequenceMatcher

import newrelic.agent
from django.conf import settings
from django.db.models import Q
from first import first
from six import add_metaclass

from treeherder.autoclassify.autoclassify import AUTOCLASSIFY_GOOD_ENOUGH_RATIO
from treeherder.model.models import (MatcherManager,
                                     TextLogError,
                                     TextLogErrorMatch)
from treeherder.services.elasticsearch import search
from treeherder.utils.itertools import compact

logger = logging.getLogger(__name__)

Match = namedtuple('Match', ['text_log_error', 'classified_failure_id', 'score'])


@add_metaclass(ABCMeta)
class Matcher(object):
    """
    Parent class for Matchers, provides __call__ entry point.

    Class that is called with a list of unmatched failure lines from a specific
    job, and returns a list of Match tuples containing the failure_line that
    matched, the failure it matched with, and the score, which is a number in
    the range 0-1 with 1 being a perfect match and 0 being the worst possible
    match.
    """
    def __init__(self, db_object):
        """Attach the db_object to the matcher so it can be inspected elsewhere."""
        self.db_object = db_object

    def __call__(self, text_log_errors):
        """
        Main entry point for all matchers.

        Filters the given TextLogErrors to those with related FailureLines
        before calling self.match.
        """
        # Only look at TextLogErrors with related FailureLines
        text_log_errors = (t for t in text_log_errors if t.metadata and t.metadata.failure_line)
        # TODO: move checks on failure_line.action and failure_line.action here
        return compact(self.match(tle) for tle in text_log_errors)

    def match(self, text_log_error):
        """Find the best match for a given TextLogError."""
        best_match = self.query_best(text_log_error)
        if best_match:
            classified_failure_id, score = best_match
            logger.debug("Matched using %s", self.__class__.__name__)
            return Match(text_log_error,
                         classified_failure_id,
                         score)

    @abstractmethod
    def query_best(self, text_log_error):
        """All child classes must implement this method."""
        pass


def score_by_classified_fail_id(matches):
    """Get a tuple of the best (match, score) and its ClassifiedFailure ID."""
    if not matches:
        return

    # list of (match, score) pairs
    # get the best score
    match_and_score = first(matches, key=lambda m: (-m[1], -m[0].classified_failure_id))
    if not match_and_score:
        return

    match, score = match_and_score
    return match.classified_failure_id, score


def score_matches(matches, score_multiplier=(1, 1)):
    """
    Get scores for the given matches.

    Given a QuerySet of TextLogErrorMatches produce a score for each one until
    Good Enough™.  An optional score multiplier can be passed in.
    """
    # TODO: this should probably loop the input returning all scores unless one
    # is bigger than the Good Enough ratio.  Otherwise we only take the first
    # score from each _chunk_ of the queryset which is meaningless to the
    # score.
    if matches is None:
        return

    match = matches.first()
    if match is None:
        return

    # generate a new score from the current match
    dividend, divisor = score_multiplier
    score = match.score * dividend / divisor

    yield (match, score)

    if score >= AUTOCLASSIFY_GOOD_ENOUGH_RATIO:
        return


def time_boxed(func, iterable, time_budget, *args):
    """
    Apply a function to the items of an iterable within a given time budget.

    Loop the given iterable, calling the given function on each item. The expended
    time is compared to the given time budget after each iteration.
    """
    time_budget = time_budget / 1000  # budget in milliseconds
    start = time.time()

    for thing in iterable:
        yield func(thing, *args)

        end = time.time() - start
        if end > time_budget:
            # Putting the condition at the end of the loop ensures that we
            # always run it once, which is useful for testing
            return


class id_window(object):
    """Decorator to process given queries in given chunk sizes with a timebox for each chunk."""
    def __init__(self, size, time_budget):
        """Store chunk size and time budget values."""
        self.size = size
        self.time_budget_ms = time_budget

    def __call__(self, f):
        """Apply run method to each query returned from the decorated method."""
        outer = self

        def inner(self, text_log_error):
            queries = f(self, text_log_error)
            if not queries:
                return

            for item in queries:
                if isinstance(item, tuple):
                    query, score_multiplier = item
                else:
                    query = item
                    score_multiplier = (1, 1)

                result = outer.run(query, score_multiplier)
                if result:
                    return result
        inner.__name__ = f.__name__
        inner.__doc__ = f.__doc__
        return inner

    def run(self, query, score_multiplier):
        """
        Get scores for matches in the given query.

        Chunks the given query by related TextLogError.id using self.size,
        checking each chunk is processed in the given time_budget.  Matches are
        sorted by score, using their related ClassifiedFailure.id as a tie
        breaker.  Returns a nested tuple of:

            (classified_failure.id, (match, score))
        """
        matches = []
        time_budget = self.time_budget_ms / 1000. if self.time_budget_ms is not None else None
        t0 = time.time()

        upper_cutoff = (TextLogError.objects
                        .order_by('-id')
                        .values_list('id', flat=True)[0])

        count = 0
        while upper_cutoff > 0:
            count += 1
            lower_cutoff = max(upper_cutoff - self.size, 0)
            window_queryset = query.filter(
                text_log_error__id__range=(lower_cutoff, upper_cutoff))
            logger.debug("[time_window] Queryset: %s", window_queryset.query)
            match = window_queryset.first()
            if match is not None:
                score = match.score * score_multiplier[0] / score_multiplier[1]
                matches.append((match, score))
                if score >= AUTOCLASSIFY_GOOD_ENOUGH_RATIO:
                    break
            upper_cutoff -= self.size

            if time_budget is not None and time.time() - t0 > time_budget:
                # Putting the condition at the end of the loop ensures that we always
                # run it once, which is useful for testing
                break

        logger.debug("[time_window] Used %i queries", count)
        if matches:
            matches.sort(key=lambda x: (-x[1], -x[0].classified_failure_id))
            best = matches[0]
            return best[0].classified_failure_id, best[1]

        return None


class PreciseTestMatcher(Matcher):
    """Matcher that looks for existing failures with identical tests and identical error message."""
    @id_window(size=20000,
               time_budget=500)
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

        return [qs]


class ElasticSearchTestMatcher(Matcher):
    """Looks for existing failures using Elasticsearch."""
    def __init__(self, *args, **kwargs):
        """Track the number of calls to Elasticsearch."""
        Matcher.__init__(self, *args, **kwargs)
        self.calls = 0

    def __call__(self, text_log_errors):
        """Check Elasticsearch has been configured."""
        if not settings.ELASTICSEARCH_URL:
            return []

        return super(ElasticSearchTestMatcher, self).__call__(text_log_errors)

    def query_best(self, text_log_error):
        """
        Query Elasticsearch and score the results.

        Uses a filtered search checking test, status, expected, and the message
        as a phrase query with non-alphabet tokens removed.
        """
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
            self.calls += 1
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
        if best_match:
            return (best_match[1]['best_classification'], best_match[0])


class CrashSignatureMatcher(Matcher):
    """Matcher that looks for crashes with identical signature."""
    @id_window(size=20000,
               time_budget=250)
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

        return [
            qs.filter(text_log_error___metadata__failure_line__test=failure_line.test),
            (qs, (8, 10)),
        ]


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


def register():
    """Register matchers enabled in settings.AUTOCLASSIFY_MATCHERS."""
    for obj_name in settings.AUTOCLASSIFY_MATCHERS:
        obj = globals()[obj_name]
        MatcherManager.register_matcher(obj)
