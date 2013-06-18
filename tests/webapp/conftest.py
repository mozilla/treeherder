import json
from treeherder.webapp import wsgi
from tests.sample_data_generator import job_data
import pytest
from webtest.app import TestApp


@pytest.fixture
def webapp():
    """
    we can use this object to test calls to a wsgi application
    """
    return TestApp(wsgi.application)


@pytest.fixture
def job_sample():
    return job_data()


@pytest.fixture
def ten_jobs_stored(jm):
    """stores a list of ten job samples"""
    guids = ['myguid%s' % x for x in range(1, 10 + 1)]

    for guid in guids:
        jm.store_job_data(
            json.dumps(job_data(job_guid=guid)),
            guid
        )
