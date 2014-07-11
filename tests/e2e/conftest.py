import os

import pytest
import simplejson as json
from django.template import Context, Template
from thclient import (TreeherderJobCollection)

from tests import test_utils


@pytest.fixture
def pending_jobs():
    """returns a list of buildapi pending jobs"""
    return json.loads(open(
        os.path.join(os.path.dirname(__file__), "pending.json")
    ).read())


@pytest.fixture
def running_jobs():
    """returns a list of buildapi running jobs"""
    return json.loads(open(
        os.path.join(os.path.dirname(__file__), "running.json")
    ).read())


@pytest.fixture
def completed_jobs(sample_data):
    """returns a list of pulse completed jobs"""
    base_dir = os.path.dirname(__file__)
    content = open(
        os.path.join(os.path.dirname(__file__), "finished.json")
    ).read()
    t = Template(content)
    c = Context({"base_dir": base_dir})
    return json.loads(t.render(c))


@pytest.fixture
def pending_jobs_stored(
    jm, pending_jobs, result_set_stored):
    """
    stores a list of buildapi pending jobs into the jobs store
    using BuildApiTreeHerderAdapter
    """

    pending_jobs.update(result_set_stored[0])

    tjc = TreeherderJobCollection(job_type='update')
    tj = tjc.get_job(pending_jobs)
    tjc.add(tj)

    test_utils.post_collection(jm.project, tjc)

@pytest.fixture
def running_jobs_stored(
    jm, running_jobs, result_set_stored):
    """
    stores a list of buildapi running jobs into the objectstore
    """
    running_jobs.update(result_set_stored[0])

    tjc = TreeherderJobCollection(job_type='update')
    tj = tjc.get_job(running_jobs)
    tjc.add(tj)

    test_utils.post_collection(jm.project, tjc)

@pytest.fixture
def completed_jobs_stored(
    jm, completed_jobs, result_set_stored, mock_send_request ):
    """
    stores a list of buildapi completed jobs into the objectstore
    """
    completed_jobs['revision_hash'] = result_set_stored[0]['revision_hash']

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(completed_jobs)
    tjc.add(tj)

    test_utils.post_collection(jm.project, tjc)

@pytest.fixture
def completed_jobs_loaded(jm, completed_jobs_stored):
    jm.process_objects(1, raise_errors=True)

    jm.disconnect()
