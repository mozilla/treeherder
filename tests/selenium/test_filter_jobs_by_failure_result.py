import pytest

from pages.treeherder import Treeherder

RESULTS = ['testfailed', 'busted', 'exception']


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    for i, status in enumerate(RESULTS):
        eleven_job_blobs[i]['job']['result'] = status
    return create_jobs(eleven_job_blobs[0:len(RESULTS)])


@pytest.mark.parametrize('result', RESULTS)
def test_filter_jobs_by_failure_result(base_url, selenium, test_jobs, result):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    assert len(page.all_jobs) == len(RESULTS)
    with page.filters_menu() as filters:
        for result in RESULTS:
            getattr(filters, 'toggle_{}_jobs'.format(result))()
    assert len(page.all_jobs) == 0
    with page.filters_menu() as filters:
        getattr(filters, 'toggle_{}_jobs'.format(result))()
    assert len(page.all_jobs) == 1
    page.all_jobs[0].click()
    assert page.info_panel.job_details.result == result
