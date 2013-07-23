from django.core.urlresolvers import reverse
from django.template import Context, Template
import pytest
from webtest.app import TestApp
import simplejson as json
from treeherder.webapp.wsgi import application
import os


@pytest.fixture
def datasource_created():
    """creates a new datasource for testing"""
    from django.conf import settings
    from treeherder.model.models import Datasource
    prefix = getattr(settings, "TEST_DB_PREFIX", "")
    for contenttype in ("objectstore","jobs"):
        Datasource.objects.create(
            project="mozilla-inbound",
            contenttype=contenttype,
            dataset=1,
            host='localhost',
            name="{}test_mozilla_inbound_{}_1".format(
                prefix,
                contenttype
            )
        )


@pytest.fixture
def pending_jobs():
    """returns a list of buildapi pending jobs"""
    return json.loads(open(
        os.path.join(os.path.dirname(__file__),"pending.json")
    ).read())


@pytest.fixture
def running_jobs():
    """returns a list of buildapi running jobs"""
    return json.loads(open(
        os.path.join(os.path.dirname(__file__),"running.json")
    ).read())


@pytest.fixture
def completed_jobs(sample_data):
    """returns a list of pulse completed jobs"""
    base_dir = os.path.dirname(__file__)
    content  = open(
        os.path.join(os.path.dirname(__file__),"finished.json")
    ).read()
    t = Template(content)
    c = Context({"base_dir":base_dir})
    return json.loads(t.render(c))


@pytest.fixture
def pending_jobs_stored(pending_jobs):
    """
    stores a list of buildapi pending jobs into the objectstore
    using BuildApiTreeHerderAdapter
    """
    project = pending_jobs['sources'][0]['repository']
    url = reverse('objectstore-list', kwargs={"project": project})
    TestApp(application).post_json(url, params=pending_jobs)


@pytest.fixture
def running_jobs_stored(running_jobs):
    """
    stores a list of buildapi running jobs into the objectstore
    using BuildApiTreeHerderAdapter
    """
    project = running_jobs['sources'][0]['repository']
    url = reverse('objectstore-list', kwargs={"project": project})
    TestApp(application).post_json(url, params=running_jobs)


@pytest.fixture
def completed_jobs_stored(completed_jobs):
    project = completed_jobs['sources'][0]['repository']
    url = reverse('objectstore-list', kwargs={"project": project})
    TestApp(application).post_json(url, params=completed_jobs)


@pytest.fixture
def jobs_model():
    from treeherder.model.derived import JobsModel
    return JobsModel('mozilla-inbound')


@pytest.fixture
def pending_jobs_loaded(pending_jobs_stored, jobs_model):
    jobs_model.process_objects(1)


@pytest.fixture
def running_jobs_loaded(running_jobs_stored, jobs_model):
    jobs_model.process_objects(1)


@pytest.fixture
def completed_jobs_loaded(completed_jobs_stored, jobs_model):
    jobs_model.process_objects(1)
