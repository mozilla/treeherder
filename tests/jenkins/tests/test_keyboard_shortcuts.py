import random

from pages.treeherder import TreeherderPage


def test_close_open_panels(base_url, selenium):
    """Open Treeherder, verify shortcut: 'Esc' closes filter and job panel.
    Open Treeherder page, open Filters panel, select random job, close all
    panels using 'esc' button, verify if all panels are closed.
    """
    page = TreeherderPage(selenium, base_url).open()

    page.click_on_filters_panel()
    page.select_random_job()

    assert page.filter_panel_is_open
    assert page.info_panel.is_open

    page.close_all_panels()

    assert not page.filter_panel_is_open
    assert not page.info_panel.is_open


def test_enter_quick_filter_shortcut(base_url, selenium):
    """Open Treeherder, verify shortcut: 'f' moves cursor to filter search box.
    Open Treeherder page, verify if search box is empty, enter search box
    filter using 'f' shortcut, type 'debug', verify if filter box contains
    word 'debug'.
    """
    page = TreeherderPage(selenium, base_url).open()
    assert page.search_term == ''

    page.filter_by('debug', method='keyboard')
    assert page.search_term == 'debug'


def test_clear_the_quick_filter_shortcut(base_url, selenium):
    """Open Treeherder, verify shortcut: CTRL + SHIFT + 'f' clears the filter search box.
    Open Treeherder page, filter by 'debug', verify if filter box contains the
    word 'debug', clear the quick filter using CTRL + SHIFT + f shortcut,
    verify if search box is empty.
    """
    page = TreeherderPage(selenium, base_url).open()

    page.filter_by('debug')

    page.clear_filter(method='keyboard')
    assert page.search_term == ''


def test_next_job_shortcut(base_url, selenium):
    """Open Treeherder, verify shortcut: 'Right Arrow' opens next job.
    Open Treeherder page, select random job and get the keyword name, select next job
    using Right Arrow shortcut, verify job keywords match."""

    page = TreeherderPage(selenium, base_url).open()
    all_jobs = page.all_jobs[:-1]

    # Check number of jobs
    random_index = random.randint(0, len(all_jobs))
    jobs = all_jobs[random_index:(random_index + 2)]

    # Select random job and job next to it
    jobs[0].click()
    assert jobs[0].selected
    assert not jobs[1].selected

    page.select_next_job()

    assert jobs[1].selected
    assert not jobs[0].selected


def test_previous_job_shortcut(base_url, selenium):
    """Open Treeherder, verify shortcut: 'Left Arrow' opens previous job.
    Open Treeherder page, select random job and get the keyword name, select previous job
    using Left Arrow shortcut, verify job keywords match."""

    page = TreeherderPage(selenium, base_url).open()
    all_jobs = page.all_jobs[:-1]

    # Check number of jobs
    random_index = random.randint(0, len(all_jobs))
    jobs = all_jobs[random_index:(random_index + 2)]

    # Select random job and previous job
    jobs[1].click()
    assert jobs[1].selected
    assert not jobs[0].selected

    page.select_previous_job()

    assert jobs[0].selected
    assert not jobs[1].selected
