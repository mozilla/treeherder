from django.core.urlresolvers import reverse
from webtest import TestApp

from treeherder.config.wsgi import application


def test_pending_job_available(test_repository, pending_jobs_stored):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": test_repository.name})
    )
    jobs = resp.json

    assert len(jobs['results']) == 1

    assert jobs['results'][0]['state'] == 'pending'


def test_running_job_available(test_repository, running_jobs_stored):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": test_repository.name})
    )
    jobs = resp.json

    assert len(jobs['results']) == 1

    assert jobs['results'][0]['state'] == 'running'


def test_completed_job_available(test_repository, completed_jobs_stored):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": test_repository.name})
    )
    jobs = resp.json

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'completed'


def test_pending_stored_to_running_loaded(test_repository, pending_jobs_stored,
                                          running_jobs_stored):
    """
    tests a job transition from pending to running
    given a loaded pending job, if I store and load the same job with status running,
    the latter is shown in the jobs endpoint
    """
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": test_repository.name})
    )
    jobs = resp.json

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'running'


def test_finished_job_to_running(test_repository, completed_jobs_stored,
                                 running_jobs_stored):
    """
    tests that a job finished cannot change state
    """
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": test_repository.name})
    )
    jobs = resp.json

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'completed'


def test_running_job_to_pending(test_repository, running_jobs_stored,
                                pending_jobs_stored):
    """
    tests that a job transition from pending to running
    cannot happen
    """
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": test_repository.name})
    )
    jobs = resp.json

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'running'
