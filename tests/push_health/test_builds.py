from treeherder.etl.jobs import store_job_data
from treeherder.push_health.builds import get_build_failures


def test_get_build_failures(
    failure_classifications, test_push, test_repository, sample_data, mock_log_parser
):
    jobs = sample_data.job_data[20:25]
    likely_build_regression_labels = ['B2G Emulator Image Build']

    for blob in jobs:
        blob['revision'] = test_push.revision
        blob['job']['result'] = 'busted'
        blob['job']['taskcluster_task_id'] = 'V3SVuxO8TFy37En_6HcXLs'
        blob['job']['taskcluster_retry_id'] = '0'
    store_job_data(test_repository, jobs)

    result, build_failures, in_progress = get_build_failures(
        test_push, likely_build_regression_labels
    )

    assert in_progress == 0
    assert result == 'fail'
    assert len(build_failures) == 2
