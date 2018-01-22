import pytest

from pages.treeherder import Treeherder
from treeherder.etl.jobs import store_job_data
from treeherder.model.models import Job


@pytest.fixture
def test_jobs(eleven_job_blobs, failure_classifications, test_repository):
    jobs = eleven_job_blobs[0:2]
    for job in jobs:
        job['job']['result'] = 'testfailed'
    store_job_data(test_repository, jobs)
    return [Job.objects.get(id=i) for i in range(1, len(jobs) + 1)]


def test_select_next_unclassified_job(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    for i in range(len(test_jobs)):
        page.select_next_unclassified_job()
        assert page.all_jobs[i].selected


def test_select_previous_unclassified_job(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    for i in reversed(range(len(test_jobs))):
        page.select_previous_unclassified_job()
        assert page.all_jobs[i].selected
