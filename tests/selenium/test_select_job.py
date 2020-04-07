import pytest
from pages.treeherder import Treeherder


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    return create_jobs(eleven_job_blobs[0:2])


def test_select_next_job(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    page.all_jobs[0].click()
    assert page.all_jobs[0].selected
    assert not page.all_jobs[1].selected
    page.select_next_job()
    assert not page.all_jobs[0].selected
    assert page.all_jobs[1].selected


def test_select_previous_job(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    page.all_jobs[1].click()
    assert not page.all_jobs[0].selected
    assert page.all_jobs[1].selected
    page.select_previous_job()
    assert page.all_jobs[0].selected
    assert not page.all_jobs[1].selected
