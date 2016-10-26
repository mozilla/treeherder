import logging
import time
from abc import (ABCMeta,
                 abstractmethod)
from collections import namedtuple
from difflib import SequenceMatcher

from django.conf import settings
from django.db.models import Q
from elasticsearch_dsl.query import Match as ESMatch

from treeherder.autoclassify.autoclassify import AUTOCLASSIFY_GOOD_ENOUGH_RATIO
from treeherder.model.models import (MatcherManager,
                                     TextLogError,
                                     TextLogErrorMatch)
from treeherder.model.search import (TestFailureLine,
                                     es_connected)

logger = logging.getLogger(__name__)

Match = namedtuple('Match', ['text_log_error', 'classified_failure_id', 'score'])


class Matcher(object):
    __metaclass__ = ABCMeta

    """Class that is called with a list of unmatched failure lines
    from a specific job, and returns a list of Match tuples
    containing the failure_line that matched, the failure it
    matched with, and the score, which is a number in the range
    0-1 with 1 being a perfect match and 0 being the worst possible
    match."""

    def __init__(self, db_object):
        self.db_object = db_object

    def __call__(self, text_log_errors):
        rv = []
        for text_log_error in text_log_errors:
            match = self.match(text_log_error)
            if match:
                rv.append(match)
        return rv

    def match(self, text_log_error):
        best_match = self.query_best(text_log_error)
        if best_match:
            classified_failure_id, score = best_match
            logger.debug("Matched using %s" % self.__class__.__name__)
            return Match(text_log_error,
                         classified_failure_id,
                         score)

    @abstractmethod
    def query_best(self, text_log_error):
        pass


ignored_line = (Q(text_log_error___metadata__best_classification=None) &
                Q(text_log_error___metadata__best_is_verified=True))


class id_window(object):
    def __init__(self, size, time_budget):
        self.size = size
        self.time_budget_ms = time_budget

    def __call__(self, f):
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
            logger.debug("[time_window] Queryset: %s" % window_queryset.query)
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

        logger.debug("[time_window] Used %i queries" % count)
        if matches:
            matches.sort(key=lambda x: (-x[1], -x[0].classified_failure_id))
            best = matches[0]
            return best[0].classified_failure_id, best[1]

        return None


def with_failure_lines(f):
    def inner(self, text_log_errors):
        with_failure_lines = [item for item in text_log_errors
                              if item.metadata and item.metadata.failure_line]
        return f(self, with_failure_lines)
    inner.__name__ = f.__name__
    inner.__doc__ = f.__doc__
    return inner


class PreciseTestMatcher(Matcher):
    """Matcher that looks for existing failures with identical tests and
    identical error message."""

    @with_failure_lines
    def __call__(self, text_log_errors):
        return super(PreciseTestMatcher, self).__call__(text_log_errors)

    @id_window(size=20000,
               time_budget=500)
    def query_best(self, text_log_error):
        failure_line = text_log_error.metadata.failure_line
        logger.debug("Looking for test match in failure %d" % failure_line.id)

        if failure_line.action != "test_result" or failure_line.message is None:
            return

        return [(TextLogErrorMatch.objects
                 .filter(text_log_error___metadata__failure_line__action="test_result",
                         text_log_error___metadata__failure_line__test=failure_line.test,
                         text_log_error___metadata__failure_line__subtest=failure_line.subtest,
                         text_log_error___metadata__failure_line__status=failure_line.status,
                         text_log_error___metadata__failure_line__expected=failure_line.expected,
                         text_log_error___metadata__failure_line__message=failure_line.message)
                 .exclude(ignored_line |
                          Q(text_log_error__step__job=text_log_error.step.job))
                 .order_by("-score", "-classified_failure"))]


class ElasticSearchTestMatcher(Matcher):
    """Matcher that looks for existing failures with identical tests, and error
    message that is a good match when non-alphabetic tokens have been removed."""

    def __init__(self, *args, **kwargs):
        Matcher.__init__(self, *args, **kwargs)
        self.lines = 0
        self.calls = 0

    @es_connected(default=[])
    @with_failure_lines
    def __call__(self, text_log_errors):
        return super(ElasticSearchTestMatcher, self).__call__(text_log_errors)

    def query_best(self, text_log_error):
        failure_line = text_log_error.metadata.failure_line
        if failure_line.action != "test_result" or not failure_line.message:
            logger.debug("Skipped elasticsearch matching")
            return
        match = ESMatch(message={"query": failure_line.message[:1024],
                                 "type": "phrase"})
        search = (TestFailureLine.search()
                  .filter("term", test=failure_line.test)
                  .filter("term", status=failure_line.status)
                  .filter("term", expected=failure_line.expected)
                  .filter("exists", field="best_classification")
                  .query(match))
        if failure_line.subtest:
            search = search.filter("term", subtest=failure_line.subtest)
        try:
            self.calls += 1
            resp = search.execute()
        except:
            logger.error("Elastic search lookup failed: %s %s %s %s %s",
                         failure_line.test, failure_line.subtest, failure_line.status,
                         failure_line.expected, failure_line.message)
            raise
        scorer = MatchScorer(failure_line.message)
        matches = [(item, item.message) for item in resp]
        best_match = scorer.best_match(matches)
        if best_match:
            return (best_match[1].best_classification, best_match[0])


class CrashSignatureMatcher(Matcher):
    """Matcher that looks for crashes with identical signature"""

    @with_failure_lines
    def __call__(self, text_log_errors):
        return super(CrashSignatureMatcher, self).__call__(text_log_errors)

    @id_window(size=20000,
               time_budget=250)
    def query_best(self, text_log_error):
        failure_line = text_log_error.metadata.failure_line

        if (failure_line.action != "crash" or
            failure_line.signature is None or
            failure_line.signature == "None"):
            return

        matching_failures = (TextLogErrorMatch.objects
                             .filter(text_log_error___metadata__failure_line__action="crash",
                                     text_log_error___metadata__failure_line__signature=failure_line.signature)
                             .exclude(ignored_line |
                                      Q(text_log_error__step__job=text_log_error.step.job))
                             .select_related('text_log_error',
                                             'text_log_error___metadata')
                             .order_by("-score", "-classified_failure"))

        return [matching_failures.filter(text_log_error___metadata__failure_line__test=failure_line.test),
                (matching_failures, (8, 10))]


class MatchScorer(object):
    """Simple scorer for similarity of strings based on python's difflib
    SequenceMatcher"""

    def __init__(self, target):
        """:param target: The string to which candidate strings will be
        compared"""
        self.matcher = SequenceMatcher(lambda x: x == " ")
        self.matcher.set_seq2(target)

    def best_match(self, matches):
        """Return the most similar string to the target string from a list
        of candidates, along with a score indicating the goodness of the match.

        :param matches: A list of candidate matches
        :returns: A tuple of (score, best_match)"""
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
    for obj_name in settings.AUTOCLASSIFY_MATCHERS:
        obj = globals()[obj_name]
        MatcherManager.register_matcher(obj)
