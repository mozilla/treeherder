import pytest
import random

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_unclassified_failure(base_url, selenium):
    """Open resultset page and search for next unclassified failure"""
    page = TreeherderPage(selenium, base_url).open()
    assert page.unclassified_failure_count > 0
    page.open_next_unclassified_failure()
    teststatus = page.info_panel.job_details.job_result_status
    assert teststatus in ['busted', 'testfailed', 'exception']


@pytest.mark.nondestructive
def test_open_unclassified_failure_log(base_url, selenium):
    """Open the job log and verify there is content"""
    treeherder_page = TreeherderPage(selenium, base_url).open()
    assert treeherder_page.unclassified_failure_count > 0
    treeherder_page.open_next_unclassified_failure()
    logviewer_page = treeherder_page.info_panel.job_details.open_logviewer()
    assert logviewer_page.is_job_status_visible


@pytest.mark.nondestructive
def test_view_unclassified_jobs(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    all_jobs = page.all_jobs

    page.filter_unclassified_jobs()
    filtered_jobs = page.all_jobs
    assert not all_jobs == filtered_jobs

    job = random.choice(filtered_jobs)
    unclassified = ['testfailed', 'busted', 'exception']
    assert any(status in job.title for status in unclassified)
