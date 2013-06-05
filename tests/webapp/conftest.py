from webtest import TestApp
from treeherder.webapp import wsgi
from tests.sample_data_generator import job_json
import pytest


@pytest.fixture
def webapp():
    """
    we can use this object to test calls to a wsgi application
    """
    return TestApp(wsgi.application)


@pytest.fixture
def job_sample():
    return job_json()
