import pytest

from pages.treeherder import Treeherder
from treeherder.etl.jobs import store_job_data

RESULTS = ['testfailed', 'busted', 'exception']


@pytest.fixture
def test_jobs(eleven_job_blobs, failure_classifications, test_repository):
    for i, status in enumerate(RESULTS):
        eleven_job_blobs[i]['job']['result'] = status
    store_job_data(test_repository, eleven_job_blobs[0:len(RESULTS)])


@pytest.mark.parametrize('result', RESULTS)
def test_filter_jobs_by_failure_result(base_url, selenium, test_jobs, result):
    page = Treeherder(selenium, base_url).open()
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
