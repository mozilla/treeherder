import logging
from abc import ABCMeta, abstractmethod
from collections import namedtuple
from treeherder.model import models
from treeherder.model.models import FailureMatch

logger = logging.getLogger(__name__)

Match = namedtuple('Match', ['failure_line', 'classified_failure', 'score'])

class Matcher(object):
    __metaclass__ = ABCMeta

    """Class that is called with a list of unmatched failure lines
    from a specific job, and returns a list of"""

    def __init__(self, db_object):
        self.db_object = db_object

    @abstractmethod
    def __call__(self, failure_lines):
        pass


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
                        failure_line__id=failure_line.id).order_by("-score",
                                                                   "-classified_failure__modified")

                best_match = matching_failures.first()
                if best_match:
                    rv.append(Match(failure_line,
                                    best_match.classified_failure,
                                    best_match.score))
        return rv


def register():
    for obj in [PreciseTestMatcher]:
        models.Matcher.objects.register_matcher(obj)
