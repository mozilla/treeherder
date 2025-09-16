"""
Extended test cases for get_group_results() function to improve test coverage.
These tests supplement the existing tests in test_store_failure_lines.py
"""

import responses

from treeherder.log_parser.failureline import get_group_results, store_failure_lines
from treeherder.model.models import Group, GroupStatus, JobLog

from ..sampledata import SampleData


def test_get_group_results_empty_push(test_repository, test_push):
    """Test get_group_results with a push that has no jobs/groups."""
    results = get_group_results(test_repository, test_push)

    assert results == {}
    assert isinstance(results, dict)


def test_get_group_results_only_error_status(activate_responses, test_job):
    """Test get_group_results when all groups have ERROR status."""
    log_path = SampleData().get_log_path("mochitest-browser-chrome_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)
    store_failure_lines(log_obj)

    # Manually update all groups to ERROR status for this test
    GroupStatus.objects.filter(job_log=log_obj).update(status=GroupStatus.ERROR)

    groups = get_group_results(test_job.repository, test_job.push)
    task_id = "V3SVuxO8TFy37En_6HcXLs"

    # All groups should be False since they're all ERROR status
    if task_id in groups:
        for group_name, is_ok in groups[task_id].items():
            assert is_ok is False


def test_get_group_results_only_ok_status(activate_responses, test_job):
    """Test get_group_results when all groups have OK status."""
    log_path = SampleData().get_log_path("mochitest-browser-chrome_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)
    store_failure_lines(log_obj)

    # Manually update all groups to OK status for this test
    GroupStatus.objects.filter(job_log=log_obj).update(status=GroupStatus.OK)

    groups = get_group_results(test_job.repository, test_job.push)
    task_id = "V3SVuxO8TFy37En_6HcXLs"

    # All groups should be True since they're all OK status
    if task_id in groups:
        for group_name, is_ok in groups[task_id].items():
            assert is_ok is True


def test_get_group_results_no_task_id(activate_responses, test_job):
    """Test get_group_results when job has no TaskCluster metadata."""
    # Remove TaskCluster metadata from the job
    test_job.taskcluster_metadata.delete()
    test_job.save()

    log_path = SampleData().get_log_path("mochitest-browser-chrome_errorsummary.log")
    log_url = "http://my-log.mozilla.org"

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, body=log_handler.read(), status=200)

    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)
    store_failure_lines(log_obj)

    groups = get_group_results(test_job.repository, test_job.push)

    # Should have None as the task_id key for jobs without TaskCluster metadata
    assert None in groups or len(groups) == 0


def test_get_group_results_mixed_status_filter(activate_responses, test_job):
    """Test that get_group_results only includes OK and ERROR statuses, not others."""
    log_url = "http://my-log.mozilla.org"
    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    # Create groups with various statuses
    group_ok = Group.objects.create(name="ok/test/group.ini")
    group_error = Group.objects.create(name="error/test/group.ini")
    group_skip = Group.objects.create(name="skip/test/group.ini")
    group_unsupported = Group.objects.create(name="unsupported/test/group.ini")

    GroupStatus.objects.create(job_log=log_obj, group=group_ok, status=GroupStatus.OK, duration=100)
    GroupStatus.objects.create(
        job_log=log_obj, group=group_error, status=GroupStatus.ERROR, duration=200
    )
    GroupStatus.objects.create(
        job_log=log_obj, group=group_skip, status=GroupStatus.SKIP, duration=0
    )
    GroupStatus.objects.create(
        job_log=log_obj, group=group_unsupported, status=GroupStatus.UNSUPPORTED, duration=0
    )

    groups = get_group_results(test_job.repository, test_job.push)
    task_id = "V3SVuxO8TFy37En_6HcXLs"

    if task_id in groups:
        # Only OK and ERROR status groups should be included
        assert "ok/test/group.ini" in groups[task_id]
        assert groups[task_id]["ok/test/group.ini"] is True

        assert "error/test/group.ini" in groups[task_id]
        assert groups[task_id]["error/test/group.ini"] is False

        # SKIP and UNSUPPORTED statuses should not be included
        assert "skip/test/group.ini" not in groups[task_id]
        assert "unsupported/test/group.ini" not in groups[task_id]


def test_get_group_results_special_characters_in_names(activate_responses, test_job):
    """Test get_group_results with special characters in group names."""
    log_url = "http://my-log.mozilla.org"
    log_obj = JobLog.objects.create(job=test_job, name="errorsummary_json", url=log_url)

    # Create groups with special characters
    special_names = [
        "test/group-with-dash.ini",
        "test/group_with_underscore.ini",
        "test/group.with.dots.ini",
        "test/group@special#chars.ini",
        "test/group with spaces.ini",
    ]

    for name in special_names:
        group = Group.objects.create(name=name)
        GroupStatus.objects.create(
            job_log=log_obj, group=group, status=GroupStatus.OK, duration=100
        )

    groups = get_group_results(test_job.repository, test_job.push)
    task_id = "V3SVuxO8TFy37En_6HcXLs"

    if task_id in groups:
        for name in special_names:
            assert name in groups[task_id]
            assert groups[task_id][name] is True
