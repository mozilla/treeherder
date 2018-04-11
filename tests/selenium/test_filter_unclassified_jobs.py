import pytest

from pages.treeherder import Treeherder

RESULTS = ['testfailed', 'busted', 'exception']


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    results = ['success'] + RESULTS
    for i, status in enumerate(results):
        eleven_job_blobs[i]['job']['result'] = status
    return create_jobs(eleven_job_blobs[0:len(results)])


def test_filter_unclassified_jobs(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    page.filter_unclassified_jobs()
    assert len(page.all_jobs) == len(RESULTS)
