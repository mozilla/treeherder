import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_by_job_keyword(base_url, selenium):
    """Open Treeherder page, select random job, click on the job keyword,
    verify if filtered jobs have the same platform name"""
    page = TreeherderPage(selenium, base_url).open()
    page.select_random_job()

    page.job_details.filter_by_job_keyword()
    keyword = page.job_details.job_keyword_name
    print keyword

    page.select_random_job()
    assert keyword in page.job_details.job_keyword_name
