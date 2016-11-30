import pytest
from webtest.app import TestApp

from treeherder.config import wsgi


@pytest.fixture
def webapp():
    """
    we can use this object to test calls to a wsgi application
    """
    return TestApp(wsgi.application)
