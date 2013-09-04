from django.core.urlresolvers import reverse
from django.template import Context, Template
import pytest
from webtest.app import TestApp
import simplejson as json
from treeherder.webapp.wsgi import application
import os


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
def result_set_stored(jm, sample_resultset):

    jm.store_result_set_data(
        sample_resultset['revision_hash'],
        sample_resultset['push_timestamp'],
        sample_resultset['revisions']
    )
    return sample_resultset


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
def pending_jobs_stored(jm, pending_jobs, result_set_stored):
    """
    stores a list of buildapi pending jobs into the objectstore
    using BuildApiTreeHerderAdapter
    """
    pending_jobs['revision_hash'] = result_set_stored['revision_hash']
    url = reverse('objectstore-list', kwargs={"project": jm.project})
    TestApp(application).post_json(url, params=pending_jobs)


@pytest.fixture
def running_jobs_stored(jm, running_jobs, result_set_stored):
    """
    stores a list of buildapi running jobs into the objectstore
    using BuildApiTreeHerderAdapter
    """
    running_jobs['revision_hash'] = result_set_stored['revision_hash']
    url = reverse('objectstore-list', kwargs={"project": jm.project})
    TestApp(application).post_json(url, params=running_jobs)


@pytest.fixture
def completed_jobs_stored(jm, completed_jobs, result_set_stored):
    """
    stores a list of buildapi completed jobs into the objectstore
    using BuildApiTreeHerderAdapter
    """
    completed_jobs['revision_hash'] = result_set_stored['revision_hash']
    url = reverse('objectstore-list', kwargs={"project": jm.project})
    TestApp(application).post_json(url, params=completed_jobs)


@pytest.fixture
def pending_jobs_loaded(jm, pending_jobs_stored):
    jm.process_objects(1, raise_errors=True)


@pytest.fixture
def running_jobs_loaded(jm, running_jobs_stored):
    jm.process_objects(1, raise_errors=True)


@pytest.fixture
def completed_jobs_loaded(jm, completed_jobs_stored):
    jm.process_objects(1, raise_errors=True)
