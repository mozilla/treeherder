import copy

import pytest

from treeherder.etl.job_loader import (JobLoader,
                                       MissingResultsetException)
from treeherder.model.derived.artifacts import ArtifactsModel
from treeherder.model.models import (Job,
                                     JobDetail,
                                     JobLog)


@pytest.fixture
def first_job(sample_data, test_project, result_set_stored):
    revision = result_set_stored[0]["revisions"][0]["revision"]
    job = copy.deepcopy(sample_data.pulse_jobs[0])
    job["origin"]["project"] = test_project
    job["origin"]["revision"] = revision
    return job


@pytest.fixture
def pulse_jobs(sample_data, test_project, result_set_stored):
    revision = result_set_stored[0]["revisions"][0]["revision"]
    jobs = copy.deepcopy(sample_data.pulse_jobs)
    for job in jobs:
        job["origin"]["project"] = test_project
        job["origin"]["revision"] = revision
    return jobs


@pytest.fixture
def transformed_pulse_jobs(sample_data, test_project):
    jobs = copy.deepcopy(sample_data.transformed_pulse_jobs)
    return jobs


def test_job_transformation(pulse_jobs, transformed_pulse_jobs):
    jl = JobLoader()
    validated_jobs = jl._get_validated_jobs_by_project(pulse_jobs)
    import json
    for (idx, job) in enumerate(validated_jobs["test_treeherder_jobs"]):
        assert transformed_pulse_jobs[idx] == json.loads(json.dumps(jl.transform(job)))


def test_ingest_pulse_jobs(pulse_jobs, test_project, jm, result_set_stored,
                           mock_log_parser):
    """
    Ingest a job through the JSON Schema validated JobLoader used by Pulse
    """

    jl = JobLoader()
    revision = result_set_stored[0]["revision"]
    for job in pulse_jobs:
        job["origin"]["revision"] = revision

    jl.process_job_list(pulse_jobs)

    jobs = jm.get_job_list(0, 10)
    assert len(jobs) == 4

    job_logs = JobLog.objects.filter(job__project_specific_id=jobs[0]["id"])
    assert job_logs.count() == 2
    logs_expected = [{"name": "builds-4h",
                      "url": "http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/tinderbox-builds/mozilla-inbound-linux64/mozilla-inbound_linux64_spidermonkey-warnaserr-bm57-build1-build352.txt.gz",
                      "parse_status": 0},
                     {"name": "errorsummary_json",
                      "url": "http://mozilla-releng-blobs.s3.amazonaws.com/blobs/Mozilla-Inbound-Non-PGO/sha512/05c7f57df6583c6351c6b49e439e2678e0f43c2e5b66695ea7d096a7519e1805f441448b5ffd4cc3b80b8b2c74b244288fda644f55ed0e226ef4e25ba02ca466",
                      # Note that the test causes store_failure_lines to be
                      # run, which sets this to parsed.
                      "parse_status": 1}]
    assert [{"name": item.name, "url": item.url, "parse_status": item.status}
            for item in job_logs.all()] == logs_expected

    with ArtifactsModel(test_project) as am:
        artifacts = am.get_job_artifact_list(0, 10)
        assert len(artifacts) == 2

    assert JobDetail.objects.count() == 2


def test_ingest_pulse_jobs_with_revision_hash(pulse_jobs, test_project, jm,
                                              result_set_stored,
                                              mock_log_parser):
    """
    Ingest a revision_hash job with the JobLoader used by Pulse
    """

    jl = JobLoader()
    rs = jm.get_result_set_list(0, 10)[0]
    revision_hash = rs["revision_hash"]
    for job in pulse_jobs:
        origin = job["origin"]
        del(origin["revision"])
        origin["revision_hash"] = revision_hash

    jl.process_job_list(pulse_jobs)

    assert Job.objects.count() == 4


def test_ingest_pulse_jobs_with_missing_resultset(pulse_jobs, test_project, jm,
                                                  result_set_stored,
                                                  mock_log_parser):
    """
    Ingest jobs with missing resultsets, so they should throw an exception
    """

    jl = JobLoader()
    job = pulse_jobs[0]
    job["origin"]["revision"] = "1234567890123456789012345678901234567890"

    try:
        jl.process_job_list(pulse_jobs)
        assert False
    except MissingResultsetException:
        assert True

    # if one job isn't ready, except on the whole batch.  They'll retry as a
    # task after the timeout.
    assert Job.objects.count() == 0


def test_transition_pending_running_complete(first_job, jm, mock_log_parser):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "pending", "unknown", "pending", "unknown")
    change_state_result(first_job, jl, jm, "running", "unknown", "running", "unknown")
    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "testfailed")


def test_transition_complete_pending_stays_complete(first_job, jm, mock_log_parser):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "testfailed")
    change_state_result(first_job, jl, jm, "pending", "unknown", "completed", "testfailed")


def test_transition_complete_running_stays_complete(first_job, jm, mock_log_parser):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "testfailed")
    change_state_result(first_job, jl, jm, "running", "unknown", "completed", "testfailed")


def test_transition_running_pending_stays_running(first_job, jm, mock_log_parser):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "running", "unknown", "running", "unknown")
    change_state_result(first_job, jl, jm, "pending", "unknown", "running", "unknown")


def test_transition_pending_retry_fail_stays_retry(first_job, jm, mock_log_parser):
    jl = JobLoader()

    change_state_result(first_job, jl, jm, "pending", "unknown", "pending", "unknown")
    first_job["isRetried"] = True
    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "retry")
    first_job["isRetried"] = False
    change_state_result(first_job, jl, jm, "completed", "fail", "completed", "retry")


def test_skip_unscheduled(first_job, jm, mock_log_parser):
    jl = JobLoader()
    first_job["state"] = "unscheduled"
    jl.process_job_list([first_job])

    jobs = jm.get_job_list(0, 10)
    assert len(jobs) == 0


def change_state_result(test_job, job_loader, jm, new_state, new_result, exp_state, exp_result):
    # make a copy so we can modify it and not affect other tests
    job = copy.deepcopy(test_job)
    job["state"] = new_state
    job["result"] = new_result
    if new_state == 'pending':
        # pending jobs wouldn't have logs and our store_job_data doesn't
        # support it.
        del job['logs']
        errorsummary_indices = [i for i, item in enumerate(job["jobInfo"].get("links", []))
                                if item.get("linkText", "").endswith("_errorsummary.log")]
        for index in errorsummary_indices:
            del job["jobInfo"]["links"][index]

    job_loader.process_job_list([job])

    jobs = jm.get_job_list(0, 10)
    assert len(jobs) == 1
    assert jobs[0]['state'] == exp_state
    assert jobs[0]['result'] == exp_result
