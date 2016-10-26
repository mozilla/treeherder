import logging
from abc import (ABCMeta,
                 abstractmethod)

from treeherder.model.models import MatcherManager

logger = logging.getLogger(__name__)


class Detector(object):
    __metaclass__ = ABCMeta
    name = None

    """Class that is called with a list of lines that correspond to
    unmatched, intermittent, failures from a specific job and that
    returns the indicies of the subset of that list that should be
    added as new targets for failure classification."""

    def __init__(self, db_object):
        self.db_object = db_object

    @abstractmethod
    def __call__(self, failure_lines):
        pass


class TestFailureDetector(Detector):
    def __call__(self, text_log_errors):
        rv = []
        with_failure_lines = [(i, item) for (i, item) in enumerate(text_log_errors)
                              if item.failure_line]
        for i, text_log_error in with_failure_lines:
            failure = text_log_error.failure_line
            if (failure.action == "test_result" and failure.test and failure.status
                and failure.expected):
                rv.append(i)
        return rv


class ManualDetector(Detector):
    """Small hack; this ensures that there's a matcher object indicating that a match
    was by manual association, but which never automatically matches any lines"""
    def __call__(self, text_log_errors):
        return []


def register():
    for obj in [ManualDetector, TestFailureDetector]:
        MatcherManager.register_detector(obj)
