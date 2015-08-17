import logging
from treeherder.model import models

logger = logging.getLogger(__name__)

class Creator(object):
    name = None

    def __init__(self, db_object):
        self.db_object = db_object


class TestFailureCreator(Creator):
    def __call__(self, failure_lines):
        rv = []
        for i, failure in enumerate(failure_lines):
            if (failure.action == "test_result" and failure.test and failure.status
                and failure.expected):
                rv.append(i)
        return rv


def register():
    for obj in [TestFailureCreator]:
        models.Matcher.objects.register_creator(obj)
