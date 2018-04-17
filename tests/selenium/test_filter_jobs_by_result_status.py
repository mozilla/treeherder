from __future__ import print_function

import pytest

from pages.treeherder import Treeherder

JOB_DATA = [
    {'result': 'testfailed'},
    {'result': 'success'},
    {'result': 'retry'},
    {'result': 'usercancel'},
    {'result': 'superseded'},
    {'result': 'unknown', 'state': 'running'}]


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    job_blobs = [j for j in eleven_job_blobs if 'superseded' not in j]
    for i, job in enumerate(JOB_DATA):
        job_blobs[i]['job'].update(job)
    return create_jobs(job_blobs[0:len(JOB_DATA)])


def test_default_filters(base_url, selenium, test_jobs):
    """Show superseded, and verify all test jobs are displayed."""
    page = Treeherder(selenium, base_url).open()
    page.toggle_superseded()  # defaults to hidden
    page.wait.until(lambda _: len(page.all_jobs) == len(test_jobs))


def test_filter_failures(base_url, selenium, test_jobs):
    """Hide all except failures and verify job is displayed."""
    page = Treeherder(selenium, base_url).open()
    page.toggle_success()
    page.toggle_retry()
    page.toggle_usercancel()
    page.toggle_in_progress()
    page.wait.until(lambda _: len(page.all_jobs) == 1)
    page.all_jobs[0].click()
    assert page.info_panel.job_details.result == 'testfailed'


def test_filter_success(base_url, selenium, test_jobs):
    """Hide all except success and verify job is displayed."""
    page = Treeherder(selenium, base_url).open()
    page.toggle_failures()
    page.toggle_retry()
    page.toggle_usercancel()
    page.toggle_in_progress()
    page.wait.until(lambda _: len(page.all_jobs) == 1)
    page.all_jobs[0].click()
    assert page.info_panel.job_details.result == 'success'


def test_filter_retry(base_url, selenium, test_jobs):
    """Hide all except verify and verify job is displayed."""
    page = Treeherder(selenium, base_url).open()
    page.toggle_success()
    page.toggle_failures()
    page.toggle_usercancel()
    page.toggle_in_progress()
    page.wait.until(lambda _: len(page.all_jobs) == 1)
    page.all_jobs[0].click()
    assert page.info_panel.job_details.result == 'retry'


def test_filter_usercancel(base_url, selenium, test_jobs):
    """Hide all except usercancel and verify job is displayed."""
    page = Treeherder(selenium, base_url).open()
    page.toggle_success()
    page.toggle_failures()
    page.toggle_retry()
    page.toggle_in_progress()
    page.wait.until(lambda _: len(page.all_jobs) == 1)
    page.all_jobs[0].click()
    assert page.info_panel.job_details.result == 'usercancel'


def test_filter_superseded(base_url, selenium, test_jobs):
    """Hide all except superseded and verify job is displayed."""
    page = Treeherder(selenium, base_url).open()
    page.toggle_success()
    page.toggle_failures()
    page.toggle_retry()
    page.toggle_usercancel()
    page.toggle_superseded()  # defaults to hidden
    page.toggle_in_progress()
    page.wait.until(lambda _: len(page.all_jobs) == 1)
    page.all_jobs[0].click()
    assert page.info_panel.job_details.result == 'superseded'


def test_filter_in_progress(base_url, selenium, test_jobs):
    """Hide all except in_progress and verify job is displayed."""
    page = Treeherder(selenium, base_url).open()
    page.toggle_success()
    page.toggle_failures()
    page.toggle_retry()
    page.toggle_usercancel()
    page.wait.until(lambda _: len(page.all_jobs) == 1)
    page.all_jobs[0].click()
    assert page.info_panel.job_details.result == 'unknown'
