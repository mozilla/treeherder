import logging
from abc import (ABCMeta,
                 abstractmethod)
from collections import namedtuple

from django.db.models import (Q,
                              Func,
                              Value)

from treeherder.model.models import (FailureMatch,
                                     MatcherManager)

logger = logging.getLogger(__name__)

Match = namedtuple('Match', ['failure_line', 'classified_failure', 'score'])


class Eq(Func):
    template = "%(expressions)s"
    # NULL-safe Equal. MySQL specific variant of IS NOT DISTINCT FROM
    arg_joiner = "<=>"


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


class PreciseTestMatcher(Matcher):
    """Matcher that looks for existing failures with identical tests and identical error
    message."""

    def __call__(self, failure_lines):
        rv = []
        for failure_line in failure_lines:
            logger.debug("Looking for test match in failure %d" % failure_line.id)

            if failure_line.action == "test_result":
                matching_failures = FailureMatch.objects.filter(
                    failure_line__action="test_result",
                    failure_line__test=failure_line.test,
                    failure_line__subtest=failure_line.subtest,
                    failure_line__status=failure_line.status,
                    failure_line__expected=failure_line.expected,
                    failure_line__message=failure_line.message).exclude(
                        ignored_line | Q(failure_line__job_guid=failure_line.job_guid)
                    ).order_by("-score", "-classified_failure__id")

                best_match = matching_failures.first()
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
            if failure_line.action != "crash" or failure_line.signature is None:
                continue
            matching_failures = FailureMatch.objects.filter(
                failure_line__action="crash",
                failure_line__signature=failure_line.signature).exclude(
                    ignored_line | Q(failure_line__job_guid=failure_line.job_guid)
                ).select_related('failure_line').order_by(
                    Eq('failure_line__test', Value(failure_line.test)).desc(),
                    "-score",
                    "-classified_failure__id")
            best_match = matching_failures.first()
            if best_match:
                logger.debug("Matched using crash signature matcher")
                score = best_match.score
                # Add a made-up factor to reduce the goodness of the match
                if failure_line.test != best_match.failure_line.test:
                    score = 8 * score / 10
                rv.append(Match(failure_line,
                                best_match.classified_failure,
                                score))
        return rv


def register():
    for obj in [PreciseTestMatcher, CrashSignatureMatcher]:
        MatcherManager.register_matcher(obj)
