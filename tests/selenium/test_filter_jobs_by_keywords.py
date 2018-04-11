import pytest

from pages.treeherder import Treeherder


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    for i, platform in enumerate(['linux32', 'windowsxp']):
        eleven_job_blobs[i]['job']['machine_platform']['platform'] = platform
    return create_jobs(eleven_job_blobs[0:2])


@pytest.mark.parametrize('method', [('keyboard'), ('pointer')])
def test_filter_jobs_by_keywords(base_url, selenium, test_jobs, method):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    page.filter_by('linux', method)
    page.wait.until(lambda _: len(page.all_jobs) == 1)


def test_filter_jobs_by_keywords_from_job_panel(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    page.all_jobs[0].click()
    keywords = page.info_panel.job_details.keywords
    page.info_panel.job_details.filter_by_keywords()
    page.wait.until(lambda _: len(page.all_jobs) < len(test_jobs))
    assert page.quick_filter_term == keywords.lower()


@pytest.mark.parametrize('method', [('keyboard'), ('pointer')])
def test_clear_filter(base_url, selenium, test_jobs, method):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
    page.filter_by('linux')
    page.wait.until(lambda _: len(page.all_jobs) == 1)
    page.clear_filter(method)
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))
