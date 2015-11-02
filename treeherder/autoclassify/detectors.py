import logging
from abc import (ABCMeta,
                 abstractmethod)

from treeherder.model import models

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
    def __call__(self, failure_lines):
        rv = []
        for i, failure in enumerate(failure_lines):
            if (failure.action == "test_result" and failure.test and failure.status
                and failure.expected):
                rv.append(i)
        return rv


def register():
    for obj in [TestFailureDetector]:
        models.Matcher.objects.register_detector(obj)
