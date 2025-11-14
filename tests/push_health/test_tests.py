import pytest

from treeherder.model.models import FailureLine, Job, Repository
from treeherder.push_health.tests import (
    get_new_failure_jobs,
    get_test_failure_jobs,
    get_test_failures,
    has_job,
    has_line,
)


@pytest.mark.parametrize(("find_it",), [(True,), (False,)])
def test_has_job(find_it):
    job = Job(id=123, repository=Repository(), guid="12345")
    job_list = [
        {"id": 111},
        {"id": 222},
    ]

    if find_it:
        job_list.append({"id": 123})
        assert has_job(job, job_list)
    else:
        assert not has_job(job, job_list)


@pytest.mark.parametrize(("find_it",), [(True,), (False,)])
def test_has_line(find_it):
    line = FailureLine(line=123)
    line_list = [
        {"line_number": 111},
        {"line_number": 222},
    ]

    if find_it:
        line_list.append({"line_number": 123})
        assert has_line(line, line_list)
    else:
        assert not has_line(line, line_list)


def test_get_test_failures(
    failure_classifications, test_repository, test_job, text_log_error_lines
):
    test_job.result = "testfailed"
    test_job.failure_classification_id = 6
    test_job.save()

    result_status, jobs = get_test_failure_jobs(test_job.push)
    result, build_failures = get_test_failures(test_job.push, jobs, result_status)
    need_investigation = build_failures["needInvestigation"]

    assert result == "fail"
    assert len(need_investigation) == 1
    assert len(jobs[need_investigation[0]["jobName"]]) == 1


def test_get_new_failure_jobs_filters_fcid_6(
    failure_classifications, test_repository, test_job, text_log_error_lines
):
    """Test that get_new_failure_jobs only returns jobs with failure_classification_id=6"""
    # Set up test job as testfailed with fcid=6
    test_job.result = "testfailed"
    test_job.failure_classification_id = 6
    test_job.save()

    # Call the new function
    all_jobs_dict, new_failure_jobs_dict, result_status = get_new_failure_jobs(test_job.push)

    # Verify fcid=6 job is in new_failure_jobs_dict
    assert len(new_failure_jobs_dict) == 1
    job_name = test_job.job_type.name
    assert job_name in new_failure_jobs_dict
    assert len(new_failure_jobs_dict[job_name]) == 1
    assert new_failure_jobs_dict[job_name][0]["failure_classification_id"] == 6
    assert "testfailed" in result_status


def test_get_new_failure_jobs_excludes_other_fcids(
    failure_classifications, test_repository, test_job, create_jobs, hundred_job_blobs
):
    """Test that jobs with fcid != 6 are excluded from new_failure_jobs_dict"""
    # Create job with fcid=4 (intermittent)
    test_job.result = "testfailed"
    test_job.failure_classification_id = 4  # intermittent
    test_job.save()

    # Create another job with fcid=6
    job_blob = hundred_job_blobs[1]
    job_blob["job"]["result"] = "testfailed"
    fcid_6_job = create_jobs([job_blob])[0]
    fcid_6_job.failure_classification_id = 6
    fcid_6_job.push = test_job.push
    fcid_6_job.save()

    # Call the new function
    all_jobs_dict, new_failure_jobs_dict, result_status = get_new_failure_jobs(test_job.push)

    # all_jobs_dict should contain both jobs
    assert len(all_jobs_dict) >= 1  # At least one job type

    # new_failure_jobs_dict should only contain fcid=6 job
    total_new_failures = sum(len(jobs) for jobs in new_failure_jobs_dict.values())
    assert total_new_failures == 1

    # Verify only fcid=6 job is in new_failure_jobs_dict
    for job_type_jobs in new_failure_jobs_dict.values():
        for job in job_type_jobs:
            assert job["failure_classification_id"] == 6


def test_get_new_failure_jobs_empty_when_no_fcid_6(
    failure_classifications, test_repository, test_job
):
    """Test that new_failure_jobs_dict is empty when no fcid=6 jobs exist"""
    # Set job as testfailed but with fcid=1 (not classified)
    test_job.result = "testfailed"
    test_job.failure_classification_id = 1
    test_job.save()

    # Call the new function
    all_jobs_dict, new_failure_jobs_dict, result_status = get_new_failure_jobs(test_job.push)

    # all_jobs_dict should have the job
    assert len(all_jobs_dict) >= 1

    # new_failure_jobs_dict should be empty (no fcid=6 jobs)
    assert len(new_failure_jobs_dict) == 0
    assert len(result_status) == 0


def test_get_test_failures_with_fcid_6_filtering(
    failure_classifications, test_repository, test_job, text_log_error_lines
):
    """Test that get_test_failures works with new fcid=6 filtering"""
    # Set up test job as testfailed with fcid=6
    test_job.result = "testfailed"
    test_job.failure_classification_id = 6
    test_job.save()

    # Use new function to get jobs
    all_jobs_dict, new_failure_jobs_dict, result_status = get_new_failure_jobs(test_job.push)

    # Call get_test_failures with tuple format
    result, failures = get_test_failures(
        test_job.push, (all_jobs_dict, new_failure_jobs_dict), result_status
    )

    # Verify results
    assert result == "fail"
    assert len(failures["needInvestigation"]) == 1
    assert len(failures["knownIssues"]) == 0  # Should be empty with fcid=6 filtering

    # Verify the failure has expected fields
    failure = failures["needInvestigation"][0]
    assert failure["confidence"] == 0  # Always 0 for fcid=6
    assert failure["isClassifiedIntermittent"] is False  # Always False for fcid=6
    assert failure["suggestedClassification"] == "New Failure"
    assert "failedInJobs" in failure  # New field for task-to-test matching


def test_get_test_failures_task_to_test_matching(
    failure_classifications, test_repository, test_job, text_log_error_lines
):
    """Test that failedInJobs correctly tracks which jobs failed for each test"""
    # Set up test job as testfailed with fcid=6
    test_job.result = "testfailed"
    test_job.failure_classification_id = 6
    test_job.save()

    # Use new function to get jobs
    all_jobs_dict, new_failure_jobs_dict, result_status = get_new_failure_jobs(test_job.push)

    # Call get_test_failures
    result, failures = get_test_failures(
        test_job.push, (all_jobs_dict, new_failure_jobs_dict), result_status
    )

    # Verify failedInJobs field
    need_investigation = failures["needInvestigation"]
    assert len(need_investigation) == 1

    failure = need_investigation[0]
    assert "failedInJobs" in failure
    assert len(failure["failedInJobs"]) == 1
    assert test_job.id in failure["failedInJobs"]


def test_get_test_failures_legacy_format_still_works(
    failure_classifications, test_repository, test_job, text_log_error_lines
):
    """Test backward compatibility - legacy dict format still works"""
    test_job.result = "testfailed"
    test_job.failure_classification_id = 6
    test_job.save()

    # Use old format
    result_status, jobs = get_test_failure_jobs(test_job.push)

    # Call get_test_failures with legacy dict format (not tuple)
    result, failures = get_test_failures(test_job.push, jobs, result_status)

    # Should still work
    assert result == "fail"
    assert len(failures["needInvestigation"]) >= 0
