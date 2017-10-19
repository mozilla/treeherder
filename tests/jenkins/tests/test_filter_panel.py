import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_by_test_status(base_url, selenium):
    """Open Treeherder page, open Filters Panel, select one filter,
    verify results"""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_unclassified_jobs()

    # Test 'testfailed' unclassified failures
    page.click_on_filters_panel()
    page.deselect_busted_failures()
    page.deselect_exception_failures()
    page.click_on_filters_panel()  # close filter panel to avoid bug 1405666
    if len(page.all_jobs) > 0:
        page.open_next_unclassified_failure()
        assert 'testfailed' == page.info_panel.job_details.job_result_status

    # Test 'busted' unclassified failures
    page.click_on_filters_panel()
    page.select_busted_failures()
    page.deselect_testfailed_failures()
    page.click_on_filters_panel()  # close filter panel to avoid bug 1405666
    if len(page.all_jobs) > 0:
        page.close_the_job_panel()
        page.open_next_unclassified_failure()
        assert 'busted' == page.info_panel.job_details.job_result_status

    # Test 'exception' unclassified failures
    page.click_on_filters_panel()
    page.select_exception_failures()
    page.deselect_busted_failures()
    page.click_on_filters_panel()  # close filter panel to avoid bug 1405666
    if len(page.all_jobs) > 0:
        page.close_the_job_panel()
        page.open_next_unclassified_failure()
        assert 'exception' == page.info_panel.job_details.job_result_status


@pytest.mark.nondestructive
def test_filter_panel_reset_button(base_url, selenium):
    """Open Treeherder page, hide jobs in progress, reset filters button and
    verify in progress jobs are displayed"""
    page = TreeherderPage(selenium, base_url).open()
    assert any(j for j in page.all_jobs if j.in_progress)
    page.filter_job_in_progress()
    assert not page.nav_filter_in_progress_is_selected
    assert not any(j for j in page.all_jobs if j.in_progress)
    page.click_on_filters_panel()
    page.reset_filters()
    assert page.nav_filter_in_progress_is_selected
    assert any(j for j in page.all_jobs if j.in_progress)
