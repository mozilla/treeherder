import os
import pytest
import simplejson as json
from webtest.app import TestApp

from django.template import Context, Template

from treeherder.webapp.wsgi import application

from thclient import (TreeherderJobCollection, TreeherderRequest)

from treeherder.etl.oauth_utils import OAuthCredentials
from tests.sampledata import SampleData
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


@pytest.fixture
def mock_send_request(monkeypatch, jm):
    def _send(th_request, th_collection):

        OAuthCredentials.set_credentials(SampleData.get_credentials())
        credentials = OAuthCredentials.get_credentials(jm.project)

        th_request.oauth_key = credentials['consumer_key']
        th_request.oauth_secret = credentials['consumer_secret']

        signed_uri = th_request.get_signed_uri(
            th_collection.to_json(), th_request.get_uri(th_collection)
        )

        response = TestApp(application).post_json(
            str(signed_uri), params=th_collection.get_collection_data()
        )

        response.getcode = lambda: response.status_int
        return response

    monkeypatch.setattr(TreeherderRequest, 'send', _send)