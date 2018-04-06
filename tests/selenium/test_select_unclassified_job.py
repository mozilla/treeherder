import pytest

from pages.treeherder import Treeherder


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    job_blobs = eleven_job_blobs[0:2]
    [b['job'].update({'result': 'testfailed'}) for b in job_blobs]
    return create_jobs(job_blobs)


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
