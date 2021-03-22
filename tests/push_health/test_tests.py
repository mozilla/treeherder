from treeherder.push_health.tests import get_test_failures, get_test_failure_jobs


def test_get_test_failures(
    failure_classifications, test_repository, test_job, text_log_error_lines, eleven_job_blobs
):
    for job in eleven_job_blobs:
        job['result'] = 'success'
        job['taskcluster_metadata__task_id'] = 'V3SVuxO8TFy37En_6HcXLs'
        job['taskcluster_metadata__retry_id'] = '0'
        job['job_type__name'] = job['job']['name']
        job['job_type__symbol'] = job['job']['job_symbol']
        job['machine_platform__platform'] = job['job']['machine_platform']['platform']
        job['job_group__name'] = None
        job['job_group__symbol'] = job['job']['group_symbol']
        job['start_time'] = job['job']['start_timestamp']
        job['option_collection_hash'] = '32faaecac742100f7753f0c1d0aa0add01b4046b'

    eleven_job_blobs[0]['result'] = 'testfailed'

    test_job.result = 'testfailed'
    test_job.option_collection_hash = '32faaecac742100f7753f0c1d0aa0add01b4046b'
    test_job.save()

    result_status, jobs = get_test_failure_jobs(test_job.push, eleven_job_blobs)
    result, test_failures = get_test_failures(test_job.push, jobs, [test_job.job_type.name])
    need_investigation = test_failures['needInvestigation']['tests']

    assert result == 'fail'
    assert len(need_investigation) == 1
    assert len(jobs[list(need_investigation)[0]['jobName']]) == 1
