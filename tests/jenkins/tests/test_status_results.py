import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_default_status(base_url, selenium):
    """Open resultset page and verify default job status buttons in the nav."""
    page = TreeherderPage(selenium, base_url).open()
    assert page.nav_filter_failures_is_selected
    assert page.nav_filter_success_is_selected
    assert page.nav_filter_retry_is_selected
    assert page.nav_filter_usercancel_is_selected
    assert not page.nav_filter_superseded_is_selected
    assert page.nav_filter_in_progress_is_selected


@pytest.mark.nondestructive
def test_status_results_failures(base_url, selenium):
    """Open resultset page and verify job failure filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_successes()
    page.filter_job_retries()
    page.filter_job_usercancel()
    page.filter_job_in_progress()
    assert 0 < len(page.all_jobs) == len(page.all_failed_jobs)


@pytest.mark.nondestructive
def test_status_results_success(base_url, selenium):
    """Open resultset page and verify job status success filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_retries()
    page.filter_job_usercancel()
    page.filter_job_in_progress()
    assert 0 < len(page.all_jobs) == len(page.all_successful_jobs)


@pytest.mark.nondestructive
def test_status_results_retry(base_url, selenium):
    """Open resultset page and verify job status retry filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_successes()
    page.filter_job_usercancel()
    page.filter_job_in_progress()
    assert 0 < len(page.all_jobs) == len(page.all_restarted_jobs)


@pytest.mark.nondestructive
@pytest.mark.xfail(reason='Superseded jobs rarely occur', run=False)
def test_status_results_superseded(base_url, selenium):
    """Open resultset page and verify job status superseded filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_successes()
    page.filter_job_retries()
    page.filter_job_usercancel()
    page.filter_job_superseded()
    page.filter_job_in_progress()
    assert 0 < len(page.all_jobs) == len(page.all_superseded_jobs)


@pytest.mark.nondestructive
def test_status_results_in_progress(base_url, selenium):
    """Open resultset page and verify job status in progress filter displays correctly."""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_job_failures()
    page.filter_job_successes()
    page.filter_job_retries()
    page.filter_job_usercancel()
    assert 0 < len(page.all_jobs) == len(page.all_in_progress_jobs)
