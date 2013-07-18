from django.core.urlresolvers import reverse
from webtest import TestApp
from treeherder.webapp.wsgi import application

import logging
logging.basicConfig(filename="test.log", level=logging.DEBUG)
logger = logging.getLogger()


def test_pending_job_available(datasource_created, pending_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": "mozilla-inbound"})
    )
    jobs = resp.json

    print jobs

    assert len(jobs) ==1

    assert jobs[0]['status'] == 'pending'


def test_running_job_available(datasource_created, running_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": "mozilla-inbound"})
    )
    jobs = resp.json

    print jobs

    assert len(jobs) ==1

    assert jobs[0]['status'] == 'running'


def test_completed_job_available(datasource_created, completed_jobs_loaded):
    webapp = TestApp(application)
    resp = webapp.get(
        reverse("jobs-list", kwargs={"project": "mozilla-inbound"})
    )
    jobs = resp.json

    print jobs

    assert len(jobs) ==1

    assert jobs[0]['status'] == 'finished'