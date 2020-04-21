import pytest
from pages.treeherder import Treeherder

RESULTS = ['testfailed', 'busted', 'exception']


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    for i, status in enumerate(RESULTS):
        eleven_job_blobs[i]['job']['result'] = status
    return create_jobs(eleven_job_blobs[0 : len(RESULTS)])


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
