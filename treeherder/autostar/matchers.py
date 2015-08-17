import logging
from treeherder.model import models

from treeherder.model.models import Repository, FailureMatch, Matcher

logger = logging.getLogger(__name__)

class Matcher(object):
    def __init__(self, db_object):
        self.db_object = db_object


class PreciseTestMatcher(Matcher):
    def __call__(self, failure_lines):
        rv = []
        for failure in failure_lines:
            logger.debug("Looking for test match in failure %d" % failure.id)

            if failure.action == "test_result":
                matching_failures = FailureMatch.objects.filter(
                    failure_line__action="test_result",
                    failure_line__test=failure.test,
                    failure_line__subtest=failure.subtest,
                    failure_line__status=failure.status,
                    failure_line__expected=failure.expected,
                    failure_line__message=failure.message).exclude(
                        failure_line__id=failure.id).order_by("-score",
                                                          "-classified_failure__modified")

                if matching_failures:
                    logger.debug("Found %i matching rows" % len(matching_failures))
                    intermittent = matching_failures[0].classified_failure
                    score = matching_failures[0].score
                    rv.append((failure, intermittent, score))
        return rv


class PreciseLogMatcher(Matcher):
    def __call__(self, failure_lines):
        rv = []
        for failure in failure_lines:
            logger.debug("Looking for log match in failure %d" % failure.id)

            if failure.action == "log":
                matching_failures = FailureMatch.objects.filter(
                    failure_line__action="log",
                    failure_line__level=failure.level,
                    failure_line__message=failure.message).exclude(
                        failure_line__id=failure.id).order_by("-score",
                                                          "-classified_failure__modified")

                if matching_failures:
                    logger.debug("Found %i matching rows" % len(matching_failures))
                    intermittent = matching_failures[0].classified_failure
                    score = matching_failures[0].score
                    rv.append((failure, intermittent, score))
        return rv


def register():
    for obj in [PreciseTestMatcher, PreciseLogMatcher]:
        models.Matcher.objects.register_matcher(obj)
