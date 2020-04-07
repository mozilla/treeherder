import pytest
from pages.treeherder import Treeherder

from treeherder.model.models import JobLog


@pytest.fixture
def test_job(eleven_job_blobs, create_jobs):
    eleven_job_blobs[0]['job']['result'] = 'testfailed'
    eleven_job_blobs[0]['job']['log_references'] = []
    return create_jobs(eleven_job_blobs[0:1])[0]


@pytest.fixture(name='log')
def fixture_log(test_job):
    return JobLog.objects.create(
        job=test_job,
        name='log1',
        url='https://example.com',
        status=JobLog.PARSED)


def test_open_log_viewer(base_url, selenium, log):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: page.all_jobs)
    page.all_jobs[0].click()
    log_viewer = page.details_panel.job_details.open_log_viewer()
    assert log_viewer.seed_url in selenium.current_url
