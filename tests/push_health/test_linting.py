from treeherder.etl.jobs import store_job_data
from treeherder.push_health.linting import get_lint_failures


def test_get_linting_failures(
    failure_classifications, test_push, test_repository, sample_data, mock_log_parser
):
    jobs = sample_data.job_data[20:22]

    for blob in jobs:
        blob["revision"] = test_push.revision
        blob["job"].update(
            {
                "result": "testfailed",
                "taskcluster_task_id": "V3SVuxO8TFy37En_6HcXLs",
                "taskcluster_retry_id": "0",
            }
        )
        blob["job"]["machine_platform"]["platform"] = "lint"
    store_job_data(test_repository, jobs)

    result, build_failures, in_progress = get_lint_failures(test_push)

    assert in_progress == 0
    assert result == "fail"
    assert len(build_failures) == 2
