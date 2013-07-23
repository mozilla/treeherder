from django.core.urlresolvers import reverse
from webtest import TestApp
from treeherder.model.derived import JobsModel
from treeherder.webapp.wsgi import application

import logging
logging.basicConfig(filename="test.log", level=logging.DEBUG)
logger = logging.getLogger()


def test_pending_job_available(initial_data, datasource_created, pending_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": "mozilla-inbound"})
    )
    jobs = resp.json

    assert len(jobs) ==1

    assert jobs[0]['state'] == 'pending'


def test_running_job_available(initial_data, datasource_created, running_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": "mozilla-inbound"})
    )
    jobs = resp.json

    jm = JobsModel("mozilla-inbound")

    assert len(jobs) ==1

    assert jobs[0]['state'] == 'running'


def test_completed_job_available(initial_data, datasource_created, completed_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": "mozilla-inbound"})
    )
    jobs = resp.json

    jm = JobsModel("mozilla-inbound")

    assert len(jobs) == 1
    assert jobs[0]['state'] == 'finished'


def test_pending_stored_to_running_loaded(initial_data, datasource_created, pending_jobs_stored, running_jobs_loaded):
    """
    tests a job transition from pending to running
    given a pending job loaded in the objects store
    if I store and load the same job with status running,
    the latter is shown in the jobs endpoint
    """
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": "mozilla-inbound"})
    )
    jobs = resp.json

    jm = JobsModel("mozilla-inbound")

    assert len(jobs) == 1
    assert jobs[0]['state'] == 'running'
