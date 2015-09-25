import copy
import pytest

from treeherder.etl.job_loader import JobLoader
from treeherder.model.derived.artifacts import ArtifactsModel


@pytest.fixture
def first_job(sample_data, test_project, result_set_stored):
    revision = result_set_stored[0]["revisions"][0]["revision"]
    job = copy.deepcopy(sample_data.pulse_jobs[0])
    job["origin"]["project"] = test_project
    job["origin"]["revision"] = revision
    return job


def test_ingest_pulse_job(sample_data, test_project, jm, result_set_stored):
    """
    Ingest a job through the JSON Schema validated JobLoader used by Pulse
    """
    revision = result_set_stored[0]["revisions"][0]["revision"]
    sample_jobs = sample_data.pulse_jobs
    for job in sample_jobs:
        job["origin"]["project"] = test_project
        job["origin"]["revision"] = revision

    jl = JobLoader()
    jl.process_job_list(sample_jobs, raise_errors=True)

    jobs = jm.get_job_list(0, 10)
    assert len(jobs) == 3

    logs = jm.get_job_log_url_list([jobs[0]["id"]])
    assert len(logs) == 1
    with ArtifactsModel(test_project) as am:
        artifacts = am.get_job_artifact_list(0, 10)
        assert len(artifacts) == 2


def test_transition_pending_running_complete(first_job, jm):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "pending", "unknown", "pending", "unknown")
    change_state_result(first_job, jl, jm, "running", "unknown", "running", "unknown")
    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "testfailed")


def test_transition_complete_pending_stays_complete(first_job, jm):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "testfailed")
    change_state_result(first_job, jl, jm, "pending", "unknown", "completed", "testfailed")


def test_transition_complete_running_stays_complete(first_job, jm):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "testfailed")
    change_state_result(first_job, jl, jm, "running", "unknown", "completed", "testfailed")


def test_transition_running_pending_stays_running(first_job, jm):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "running", "unknown", "running", "unknown")
    change_state_result(first_job, jl, jm, "pending", "unknown", "running", "unknown")


def test_transition_pending_retry_fail_stays_retry(first_job, jm):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "pending", "unknown", "pending", "unknown")
    first_job["isRetried"] = True
    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "retry")
    first_job["isRetried"] = False
    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "retry")


def test_skip_unscheduled(first_job, jm):
    jl = JobLoader()
    first_job["state"] = "unscheduled"
    jl.process_job_list([first_job], raise_errors=True)

    jobs = jm.get_job_list(0, 10)
    assert len(jobs) == 0


def change_state_result(job, job_loader, jm, new_state, new_result, exp_state, exp_result):
    # make a copy so we can modify it and not affect other tests
    job = copy.deepcopy(job)
    job["state"] = new_state
    job["result"] = new_result
    if new_state == 'pending':
        # pending jobs wouldn't have logs and our store_job_data doesn't
        # support it.
        del job['logs']

    job_loader.process_job_list([job], raise_errors=True)

    jobs = jm.get_job_list(0, 10)
    assert len(jobs) == 1
    assert jobs[0]['state'] == exp_state
    assert jobs[0]['result'] == exp_result
