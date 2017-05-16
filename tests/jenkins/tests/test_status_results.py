import pytest
import random

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_default_status(base_url, selenium):
    """Open resultset page and verify default job status buttons in the nav."""
    page = TreeherderPage(selenium, base_url).open()
    assert page.nav_filter_failures_is_selected
    assert page.nav_filter_success_is_selected
    assert page.nav_filter_retry_is_selected
    assert page.nav_filter_usercancel_is_selected
    assert not page.nav_filter_coalesced_is_selected
    assert page.nav_filter_in_progress_is_selected


@pytest.mark.nondestructive
def test_status_results_failures(base_url, selenium):
    """Open resultset page and verify job failure filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_successes()
    page.filter_job_retries()
    page.filter_job_usercancel()
    page.filter_job_in_progress()

    all_jobs = page.all_jobs
    job = random.choice(all_jobs)
    unclassified = ['testfailed', 'exception', 'busted']
    assert any(status in job.title for status in unclassified)


@pytest.mark.nondestructive
def test_status_results_success(base_url, selenium):
    """Open resultset page and verify job status success filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_retries()
    page.filter_job_usercancel()
    page.filter_job_in_progress()

    assert all(map(lambda job: 'success' in job.title, page.all_jobs))


@pytest.mark.nondestructive
def test_status_results_retry(base_url, selenium):
    """Open resultset page and verify job status retry filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_successes()
    page.filter_job_usercancel()
    page.filter_job_in_progress()

    assert all(map(lambda job: 'retry' in job.title, page.all_jobs))


@pytest.mark.nondestructive
def test_status_results_coalesced(base_url, selenium):
    """Open resultset page and verify job status coalesced filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_successes()
    page.filter_job_retries()
    page.filter_job_usercancel()
    page.filter_job_coalesced()
    page.filter_job_in_progress()

    assert all(map(lambda job: 'coalesced' in job.title, page.all_jobs))


@pytest.mark.nondestructive
def test_status_results_in_progress(base_url, selenium):
    """Open resultset page and verify job status in progress filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_successes()
    page.filter_job_retries()
    page.filter_job_usercancel()

    all_jobs = page.all_jobs
    job = random.choice(all_jobs)
    runnable = ['running', 'pending']
    assert any(status in job.title for status in runnable)
