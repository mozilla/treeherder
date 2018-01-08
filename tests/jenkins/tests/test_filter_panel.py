import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_panel_reset_button(base_url, selenium):
    """Open Treeherder page, hide jobs in progress, reset filters button and
    verify in progress jobs are displayed"""
    page = TreeherderPage(selenium, base_url).open()
    assert page.all_in_progress_jobs
    page.filter_job_in_progress()
    assert not page.nav_filter_in_progress_is_selected
    assert not page.all_in_progress_jobs
    page.click_on_filters_panel()
    page.reset_filters()
    assert page.nav_filter_in_progress_is_selected
    assert page.all_in_progress_jobs
