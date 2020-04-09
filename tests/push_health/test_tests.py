from treeherder.push_health.tests import get_test_failures, get_test_failure_jobs


def test_get_test_failures(
    failure_classifications, test_repository, test_job, text_log_error_lines
):
    test_job.result = 'testfailed'
    test_job.save()

    result_status, jobs = get_test_failure_jobs(test_job.push)
    result, test_failures = get_test_failures(test_job.push, jobs, [test_job.job_type.name])
    need_investigation = test_failures['needInvestigation']['tests']

    assert result == 'fail'
    assert len(need_investigation) == 1
    assert len(jobs[list(need_investigation)[0]['jobName']]) == 1
