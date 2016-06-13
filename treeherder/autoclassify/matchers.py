import logging
import time
from abc import (ABCMeta,
                 abstractmethod)
from collections import namedtuple
from datetime import (datetime,
                      timedelta)

from django.db.models import Q

from treeherder.autoclassify.management.commands.autoclassify import AUTOCLASSIFY_GOOD_ENOUGH_RATIO
from treeherder.model.models import (FailureLine,
                                     FailureMatch,
                                     MatcherManager)

logger = logging.getLogger(__name__)

Match = namedtuple('Match', ['failure_line', 'classified_failure', 'score'])


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

    @abstractmethod
    def __call__(self, failure_lines):
        pass


ignored_line = (Q(failure_line__best_classification=None) &
                Q(failure_line__best_is_verified=True))


def time_window(queryset, interval, time_budget_ms, match_filter):
    upper_cutoff = datetime.now()
    lower_cutoff = upper_cutoff - interval
    matches = []

    time_budget = time_budget_ms / 1000. if time_budget_ms is not None else None
    t0 = time.time()

    min_date = FailureLine.objects.order_by("id")[0].created

    count = 0
    while True:
        count += 1
        window_queryset = queryset.filter(
            failure_line__created__range=(lower_cutoff, upper_cutoff))
        logger.debug("[time_window] Queryset: %s" % window_queryset.query)
        match = window_queryset.first()
        if match is not None:
            matches.append(match)
            if match.score >= AUTOCLASSIFY_GOOD_ENOUGH_RATIO:
                break
        upper_cutoff = lower_cutoff
        lower_cutoff = upper_cutoff - interval
        if upper_cutoff < min_date:
            break

        if time_budget_ms is not None and time.time() - t0 > time_budget:
            # Putting the condition at the end of the loop ensures that we always
            # run it once, which is useful for testing
            break

    logger.debug("[time_window] Used %i queries" % count)
    if matches:
        matches.sort(key=match_filter)
        return matches[0]
    return None


class PreciseTestMatcher(Matcher):
    """Matcher that looks for existing failures with identical tests and identical error
    message."""

    def __call__(self, failure_lines):
        rv = []
        for failure_line in failure_lines:
            logger.debug("Looking for test match in failure %d" % failure_line.id)

            if failure_line.action != "test_result" or failure_line.message is None:
                continue

            matching_failures = FailureMatch.objects.filter(
                failure_line__action="test_result",
                failure_line__test=failure_line.test,
                failure_line__subtest=failure_line.subtest,
                failure_line__status=failure_line.status,
                failure_line__expected=failure_line.expected,
                failure_line__message=failure_line.message).exclude(
                    ignored_line | Q(failure_line__job_guid=failure_line.job_guid)
                ).order_by("-score", "-classified_failure")

            best_match = time_window(matching_failures, timedelta(days=7), 500,
                                     lambda x: (-x.score, -x.classified_failure_id))
            if best_match:
                logger.debug("Matched using precise test matcher")
                rv.append(Match(failure_line,
                                best_match.classified_failure,
                                best_match.score))
        return rv


class CrashSignatureMatcher(Matcher):
    """Matcher that looks for crashes with identical signature"""

    def __call__(self, failure_lines):
        rv = []

        for failure_line in failure_lines:
            if (failure_line.action != "crash" or failure_line.signature is None
                or failure_line.signature == "None"):
                continue
            matching_failures = FailureMatch.objects.filter(
                failure_line__action="crash",
                failure_line__signature=failure_line.signature).exclude(
                    ignored_line | Q(failure_line__job_guid=failure_line.job_guid)
                ).select_related('failure_line').order_by(
                    "-score",
                    "-classified_failure")

            score_multiplier = 10
            matching_failures_same_test = matching_failures.filter(
                failure_line__test=failure_line.test)

            best_match = time_window(matching_failures_same_test, timedelta(days=7), 250,
                                     lambda x: (-x.score, -x.classified_failure_id))
            if not best_match:
                score_multiplier = 8
                best_match = time_window(matching_failures, timedelta(days=7), 250,
                                         lambda x: (-x.score, -x.classified_failure_id))

            if best_match:
                logger.debug("Matched using crash signature matcher")
                score = best_match.score * score_multiplier / 10
                rv.append(Match(failure_line,
                                best_match.classified_failure,
                                score))
        return rv


def register():
    for obj in [PreciseTestMatcher, CrashSignatureMatcher]:
        MatcherManager.register_matcher(obj)
