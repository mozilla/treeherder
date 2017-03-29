import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_by_test_status(base_url, selenium):
    """Open Treeherder page, open Filters Panel, select one filter,
    verify results"""
    page = TreeherderPage(selenium, base_url).open()
    page.filter_unclassified_jobs()
    page.click_on_filters_panel()

    # Test 'testfailed' unclassified failures
    page.deselect_busted_failures()
    page.deselect_exception_failures()
    if len(page.all_jobs) > 0:
        page.open_next_unclassified_failure()
        assert 'testfailed' == page.info_panel.job_details.job_result_status

    # Test 'busted' unclassified failures
    page.select_busted_failures()
    page.deselect_testfailed_failures()
    if len(page.all_jobs) > 0:
        page.close_the_job_panel()
        page.open_next_unclassified_failure()
        assert 'busted' == page.info_panel.job_details.job_result_status

    # Test 'exception' unclassified failures
    page.select_exception_failures()
    page.deselect_busted_failures()
    if len(page.all_jobs) > 0:
        page.close_the_job_panel()
        page.open_next_unclassified_failure()
        assert 'exception' == page.info_panel.job_details.job_result_status


@pytest.mark.nondestructive
def test_filter_panel_reset_button(base_url, selenium):
    """Open Treeherder page, open Filters Panel, disable all failures,
    check that all checkboxes are not selected, check that there
    are no failures, click reset button and verify that default checkboxes
    are selected"""
    page = TreeherderPage(selenium, base_url).open()
    all_jobs = len(page.all_jobs)

    page.click_on_filters_panel()
    page.deselect_all_failures()
    assert not page.checkbox_testfailed_is_selected
    assert not page.checkbox_busted_is_selected
    assert not page.checkbox_exception_is_selected

    filtered_jobs = len(page.all_jobs)
    assert not all_jobs == filtered_jobs

    page.reset_filters()
    assert page.checkbox_testfailed_is_selected
    assert page.checkbox_busted_is_selected
    assert page.checkbox_exception_is_selected
