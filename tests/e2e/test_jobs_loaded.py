from django.core.urlresolvers import reverse
from webtest import TestApp
from treeherder.webapp.wsgi import application


def test_pending_job_available(jm, initial_data, pending_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": jm.project})
    )
    jobs = resp.json

    assert len(jobs) ==1

    assert jobs[0]['state'] == 'pending'


def test_running_job_available(jm, initial_data, running_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": jm.project})
    )
    jobs = resp.json

    assert len(jobs) ==1

    assert jobs[0]['state'] == 'running'


def test_completed_job_available(jm, initial_data, completed_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": jm.project})
    )
    jobs = resp.json

    assert len(jobs) == 1
    assert jobs[0]['state'] == 'finished'


def test_pending_stored_to_running_loaded(jm, initial_data, pending_jobs_stored, running_jobs_loaded):
    """
    tests a job transition from pending to running
    given a pending job loaded in the objects store
    if I store and load the same job with status running,
    the latter is shown in the jobs endpoint
    """
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": jm.project})
    )
    jobs = resp.json

    assert len(jobs) == 1
    assert jobs[0]['state'] == 'running'
