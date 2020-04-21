import copy
import uuid

import pytest
import responses
import slugid

from treeherder.etl.exceptions import MissingPushException
from treeherder.etl.job_loader import JobLoader
from treeherder.etl.taskcluster_pulse.handler import handleMessage
from treeherder.model.models import Job, JobDetail, JobLog, TaskclusterMetadata


@pytest.fixture
def first_job(sample_data, test_repository, push_stored):
    revision = push_stored[0]["revisions"][0]["revision"]
    job = copy.deepcopy(sample_data.pulse_jobs[0])
    job["origin"]["project"] = test_repository.name
    job["origin"]["revision"] = revision
    return job


@pytest.fixture
def pulse_jobs(sample_data, test_repository, push_stored):
    revision = push_stored[0]["revisions"][0]["revision"]
    jobs = copy.deepcopy(sample_data.pulse_jobs)
    for job in jobs:
        job["origin"]["project"] = test_repository.name
        job["origin"]["revision"] = revision
    return jobs


@pytest.fixture
def transformed_pulse_jobs(sample_data, test_repository):
    jobs = copy.deepcopy(sample_data.transformed_pulse_jobs)
    return jobs


def mock_artifact(taskId, runId, artifactName):
    # Mock artifact with empty body
    baseUrl = "https://queue.taskcluster.net/v1/task/{taskId}/runs/{runId}/artifacts/{artifactName}"
    responses.add(
        responses.GET,
        baseUrl.format(taskId=taskId, runId=runId, artifactName=artifactName),
        body="",
        content_type='text/plain',
        status=200,
    )


@pytest.fixture
async def new_pulse_jobs(sample_data, test_repository, push_stored):
    revision = push_stored[0]["revisions"][0]["revision"]
    pulseMessages = copy.deepcopy(sample_data.taskcluster_pulse_messages)
    tasks = copy.deepcopy(sample_data.taskcluster_tasks)
    jobs = []
    # Over here we transform the Pulse messages into the intermediary taskcluster-treeherder
    # generated messages
    for message in list(pulseMessages.values()):
        taskId = message["payload"]["status"]["taskId"]
        task = tasks[taskId]
        print(taskId)
        # If we pass task to handleMessage we won't hit the network
        taskRuns = await handleMessage(message, task)
        # handleMessage returns [] when it is a task that is not meant for Treeherder
        for run in reversed(taskRuns):
            mock_artifact(taskId, run["retryId"], "public/logs/live_backing.log")
            run["origin"]["project"] = test_repository.name
            run["origin"]["revision"] = revision
            jobs.append(run)
    return jobs


@pytest.fixture
def new_transformed_jobs(sample_data, test_repository, push_stored):
    revision = push_stored[0]["revisions"][0]["revision"]
    jobs = copy.deepcopy(sample_data.taskcluster_transformed_jobs)
    for job in jobs.values():
        job["revision"] = revision
    return jobs


def test_job_transformation(pulse_jobs, transformed_pulse_jobs):
    import json

    jl = JobLoader()
    for idx, pulse_job in enumerate(pulse_jobs):
        assert jl._is_valid_job(pulse_job)
        assert transformed_pulse_jobs[idx] == json.loads(json.dumps(jl.transform(pulse_job)))


@responses.activate
def test_new_job_transformation(new_pulse_jobs, new_transformed_jobs, failure_classifications):
    jl = JobLoader()
    for message in new_pulse_jobs:
        # "task_id" which is not really the task_id
        job_guid = message["taskId"]
        (decoded_task_id, _) = job_guid.split("/")
        # As of slugid v2, slugid.encode() returns a string not bytestring under Python 3.
        taskId = slugid.encode(uuid.UUID(decoded_task_id))
        transformed_job = jl.process_job(message, 'https://firefox-ci-tc.services.mozilla.com')
        # Not all messages from Taskcluster will be processed
        if transformed_job:
            assert new_transformed_jobs[taskId] == transformed_job


def test_ingest_pulse_jobs(
    pulse_jobs, test_repository, push_stored, failure_classifications, mock_log_parser
):
    """
    Ingest a job through the JSON Schema validated JobLoader used by Pulse
    """

    jl = JobLoader()
    revision = push_stored[0]["revision"]
    for job in pulse_jobs:
        job["origin"]["revision"] = revision
        jl.process_job(job, 'https://firefox-ci-tc.services.mozilla.com')

    jobs = Job.objects.all()
    assert len(jobs) == 5

    assert [job.taskcluster_metadata for job in jobs]
    assert set(TaskclusterMetadata.objects.values_list('task_id', flat=True)) == set(
        [
            'IYyscnNMTLuxzna7PNqUJQ',
            'XJCbbRQ6Sp-UL1lL-tw5ng',
            'ZsSzJQu3Q7q2MfehIBAzKQ',
            'bIzVZt9jQQKgvQYD3a2HQw',
        ]
    )

    job_logs = JobLog.objects.filter(job_id=1)
    assert job_logs.count() == 2
    logs_expected = [
        {
            "name": "builds-4h",
            "url": "http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/tinderbox-builds/mozilla-inbound-linux64/mozilla-inbound_linux64_spidermonkey-warnaserr-bm57-build1-build352.txt.gz",
            "parse_status": 0,
        },
        {
            "name": "errorsummary_json",
            "url": "http://mozilla-releng-blobs.s3.amazonaws.com/blobs/Mozilla-Inbound-Non-PGO/sha512/05c7f57df6583c6351c6b49e439e2678e0f43c2e5b66695ea7d096a7519e1805f441448b5ffd4cc3b80b8b2c74b244288fda644f55ed0e226ef4e25ba02ca466",
            "parse_status": 0,
        },
    ]
    assert [
        {"name": item.name, "url": item.url, "parse_status": item.status} for item in job_logs.all()
    ] == logs_expected

    assert JobDetail.objects.count() == 2


def test_ingest_pending_pulse_job(
    pulse_jobs, push_stored, failure_classifications, mock_log_parser
):
    """
    Test that ingesting a pending job (1) works and (2) ingests the
    taskcluster metadata
    """
    jl = JobLoader()

    pulse_job = pulse_jobs[0]
    revision = push_stored[0]["revision"]
    pulse_job["origin"]["revision"] = revision
    pulse_job["state"] = "pending"
    jl.process_job(pulse_job, 'https://firefox-ci-tc.services.mozilla.com')

    jobs = Job.objects.all()
    assert len(jobs) == 1

    job = jobs[0]
    assert job.taskcluster_metadata
    assert job.taskcluster_metadata.task_id == 'IYyscnNMTLuxzna7PNqUJQ'

    # should not have processed any log or details for pending jobs
    assert JobLog.objects.count() == 2
    assert JobDetail.objects.count() == 2


def test_ingest_pulse_jobs_bad_project(
    pulse_jobs, test_repository, push_stored, failure_classifications, mock_log_parser
):
    """
    Test ingesting a pulse job with bad repo will skip, ingest others
    """

    jl = JobLoader()
    revision = push_stored[0]["revision"]
    job = pulse_jobs[0]
    job["origin"]["revision"] = revision
    job["origin"]["project"] = "ferd"

    for pulse_job in pulse_jobs:
        jl.process_job(pulse_job, 'https://firefox-ci-tc.services.mozilla.com')

    # length of pulse jobs is 5, so one will be skipped due to bad project
    assert Job.objects.count() == 4


def test_ingest_pulse_jobs_with_missing_push(pulse_jobs):
    """
    Ingest jobs with missing pushes, so they should throw an exception
    """

    jl = JobLoader()
    job = pulse_jobs[0]
    job["origin"]["revision"] = "1234567890123456789012345678901234567890"

    with pytest.raises(MissingPushException):
        for pulse_job in pulse_jobs:
            jl.process_job(pulse_job, 'https://firefox-ci-tc.services.mozilla.com')

    # if one job isn't ready, except on the whole batch.  They'll retry as a
    # task after the timeout.
    assert Job.objects.count() == 0


def test_transition_pending_running_complete(first_job, failure_classifications, mock_log_parser):
    jl = JobLoader()

    change_state_result(first_job, jl, "pending", "unknown", "pending", "unknown")
    change_state_result(first_job, jl, "running", "unknown", "running", "unknown")
    change_state_result(first_job, jl, "completed", "fail", "completed", "testfailed")


def test_transition_complete_pending_stays_complete(
    first_job, failure_classifications, mock_log_parser
):
    jl = JobLoader()

    change_state_result(first_job, jl, "completed", "fail", "completed", "testfailed")
    change_state_result(first_job, jl, "pending", "unknown", "completed", "testfailed")


def test_transition_complete_running_stays_complete(
    first_job, failure_classifications, mock_log_parser
):
    jl = JobLoader()

    change_state_result(first_job, jl, "completed", "fail", "completed", "testfailed")
    change_state_result(first_job, jl, "running", "unknown", "completed", "testfailed")


def test_transition_running_pending_stays_running(
    first_job, failure_classifications, mock_log_parser
):
    jl = JobLoader()

    change_state_result(first_job, jl, "running", "unknown", "running", "unknown")
    change_state_result(first_job, jl, "pending", "unknown", "running", "unknown")


def test_transition_running_superseded(first_job, failure_classifications, mock_log_parser):
    jl = JobLoader()

    change_state_result(first_job, jl, "running", "unknown", "running", "unknown")
    change_state_result(first_job, jl, "completed", "superseded", "completed", "superseded")


def test_transition_pending_retry_fail_stays_retry(
    first_job, failure_classifications, mock_log_parser
):
    jl = JobLoader()

    change_state_result(first_job, jl, "pending", "unknown", "pending", "unknown")
    first_job["isRetried"] = True
    change_state_result(first_job, jl, "completed", "fail", "completed", "retry")
    first_job["isRetried"] = False
    change_state_result(first_job, jl, "completed", "fail", "completed", "retry")


def test_skip_unscheduled(first_job, failure_classifications, mock_log_parser):
    jl = JobLoader()
    first_job["state"] = "unscheduled"
    jl.process_job(first_job, 'https://firefox-ci-tc.services.mozilla.com')

    assert not Job.objects.count()


def change_state_result(test_job, job_loader, new_state, new_result, exp_state, exp_result):
    # make a copy so we can modify it and not affect other tests
    job = copy.deepcopy(test_job)
    job["state"] = new_state
    job["result"] = new_result
    if new_state == 'pending':
        # pending jobs wouldn't have logs and our store_job_data doesn't
        # support it.
        del job['logs']
        errorsummary_indices = [
            i
            for i, item in enumerate(job["jobInfo"].get("links", []))
            if item.get("linkText", "").endswith("_errorsummary.log")
        ]
        for index in errorsummary_indices:
            del job["jobInfo"]["links"][index]

    job_loader.process_job(job, 'https://firefox-ci-tc.services.mozilla.com')

    assert Job.objects.count() == 1
    job = Job.objects.get(id=1)
    assert job.state == exp_state
    assert job.result == exp_result
