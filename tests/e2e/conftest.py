import os
import pytest
import simplejson as json
from webtest.app import TestApp

from django.core.urlresolvers import reverse
from django.template import Context, Template

from treeherder.webapp.wsgi import application
from treeherder.etl.mixins import OAuthLoaderMixin

from thclient import TreeherderJobCollection, TreeherderRequest
from tests.sampledata import SampleData


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

    OAuthLoaderMixin.set_credentials( SampleData.get_credentials() )
    credentials = OAuthLoaderMixin.get_credentials(jm.project)

    tr = TreeherderRequest(
        protocol='http',
        host='localhost',
        project=jm.project,
        oauth_key=credentials['consumer_key'],
        oauth_secret=credentials['consumer_secret']
        )

    signed_uri = tr.get_signed_uri(tjc.to_json(), tr.get_uri(tjc))

    TestApp(application).post_json(
        str(signed_uri), params=tjc.get_collection_data()
        )

@pytest.fixture
def running_jobs_stored(
    jm, running_jobs, result_set_stored):
    """
    stores a list of buildapi running jobs into the objectstore
    using BuildApiTreeHerderAdapter
    """
    running_jobs.update(result_set_stored[0])

    tjc = TreeherderJobCollection(job_type='update')
    tj = tjc.get_job(running_jobs)
    tjc.add(tj)

    OAuthLoaderMixin.set_credentials( SampleData.get_credentials() )
    credentials = OAuthLoaderMixin.get_credentials(jm.project)

    tr = TreeherderRequest(
        protocol='http',
        host='localhost',
        project=jm.project,
        oauth_key=credentials['consumer_key'],
        oauth_secret=credentials['consumer_secret']
        )

    signed_uri = tr.get_signed_uri(tjc.to_json(), tr.get_uri(tjc))

    TestApp(application).post_json(
        str(signed_uri), params=tjc.get_collection_data()
        )


@pytest.fixture
def completed_jobs_stored(
    jm, completed_jobs, result_set_stored):
    """
    stores a list of buildapi completed jobs into the objectstore
    using BuildApiTreeHerderAdapter
    """
    completed_jobs['revision_hash'] = result_set_stored[0]['revision_hash']

    tjc = TreeherderJobCollection()
    tj = tjc.get_job(completed_jobs)
    tjc.add(tj)

    OAuthLoaderMixin.set_credentials( SampleData.get_credentials() )
    credentials = OAuthLoaderMixin.get_credentials(jm.project)

    tr = TreeherderRequest(
        protocol='http',
        host='localhost',
        project=jm.project,
        oauth_key=credentials['consumer_key'],
        oauth_secret=credentials['consumer_secret']
        )

    signed_uri = tr.get_signed_uri(tjc.to_json(), tr.get_uri(tjc))

    TestApp(application).post_json(
        str(signed_uri), params=tjc.get_collection_data()
        )


@pytest.fixture
def completed_jobs_loaded(jm, completed_jobs_stored):
    jm.process_objects(1, raise_errors=True)
