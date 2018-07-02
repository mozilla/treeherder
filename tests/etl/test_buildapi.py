import os
import time

import pytest
import responses
from django.core.cache import cache

from treeherder.etl.buildapi import (BUILDS4H_URL,
                                     CACHE_KEYS,
                                     PENDING_URL,
                                     RUNNING_URL,
                                     Builds4hJobsProcess,
                                     PendingJobsProcess,
                                     RunningJobsProcess)
from treeherder.model.models import Job


@pytest.fixture
def mock_buildapi_pending_url(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-pending.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, PENDING_URL,
                  body=mocked_content, status=200,
                  content_type='application/json')


@pytest.fixture
def mock_buildapi_running_url(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-running.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, RUNNING_URL,
                  body=mocked_content, status=200,
                  content_type='application/json')


@pytest.fixture
def mock_buildapi_builds4h_url(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "buildbot_text.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, BUILDS4H_URL,
                  body=mocked_content, status=200,
                  content_type='application/json')


@pytest.fixture
def mock_buildapi_builds4h_missing1_url(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "buildbot_text-missing1.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, BUILDS4H_URL,
                  body=mocked_content, status=200,
                  content_type='application/json')


@pytest.fixture
def mock_buildapi_builds4h_missing_branch_url(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "buildbot_text-missing_branch.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, BUILDS4H_URL,
                  body=mocked_content, status=200,
                  content_type='application/json')


def test_ingest_pending_jobs(push_stored,
                             failure_classifications,
                             mock_buildapi_pending_url,
                             mock_log_parser):
    """
    a new buildapi pending job creates a new obj in the job table
    """
    etl_process = PendingJobsProcess()

    new_jobs_were_added = etl_process.run()
    assert new_jobs_were_added is True
    assert cache.get(CACHE_KEYS['pending']) == {24575179}

    new_jobs_were_added = etl_process.run()
    assert new_jobs_were_added is False

    assert Job.objects.count() == 1


def test_ingest_running_jobs(push_stored,
                             failure_classifications,
                             mock_buildapi_running_url,
                             mock_log_parser):
    """
    a new buildapi running job creates a new obj in the job table
    """
    etl_process = RunningJobsProcess()

    new_jobs_were_added = etl_process.run()
    assert new_jobs_were_added is True
    assert cache.get(CACHE_KEYS['running']) == {24767134}

    new_jobs_were_added = etl_process.run()
    assert new_jobs_were_added is False

    assert Job.objects.count() == 1


def test_ingest_builds4h_jobs(push_stored,
                              failure_classifications,
                              mock_buildapi_builds4h_url,
                              mock_log_parser):
    """
    a new buildapi completed job creates a new obj in the job table
    """
    etl_process = Builds4hJobsProcess()

    new_jobs_were_added = etl_process.run()
    assert new_jobs_were_added is True
    assert len(cache.get(CACHE_KEYS['complete'])) == 32

    new_jobs_were_added = etl_process.run()
    assert new_jobs_were_added is False

    assert Job.objects.count() == 32


def test_ingest_running_to_complete_job(push_stored,
                                        failure_classifications,
                                        mock_buildapi_running_url,
                                        mock_buildapi_builds4h_url,
                                        mock_log_parser):
    """
    a new buildapi running job transitions to a new completed job

    """
    etl_process = RunningJobsProcess()
    etl_process.run()

    assert Job.objects.count() == 1

    # the first job in the sample data should overwrite the running job
    # we just ingested.  Leaving us with only 32 jobs, not 33.
    etl_process = Builds4hJobsProcess()
    etl_process.run()

    assert Job.objects.count() == 32

    # all jobs should be completed, including the original one which
    # transitioned from running.
    for job in Job.objects.all():
        assert job.state == 'completed'


def test_ingest_running_job_fields(push_stored,
                                   failure_classifications,
                                   mock_buildapi_running_url,
                                   mock_log_parser):
    """
    a new buildapi running job creates a new obj in the job table
    """
    etl_process = RunningJobsProcess()
    etl_process.run()

    assert Job.objects.count() == 1
    assert time.mktime(Job.objects.all()[0].start_time.timetuple()) > 0


def test_ingest_builds4h_jobs_1_missing_push(push_stored,
                                             failure_classifications,
                                             mock_buildapi_builds4h_missing1_url,
                                             mock_log_parser):
    """
    Ensure the builds4h job with the missing push is not ingested
    """
    etl_process = Builds4hJobsProcess()
    etl_process.run()

    assert Job.objects.count() == 1


def test_ingest_builds4h_jobs_missing_branch(push_stored,
                                             failure_classifications,
                                             mock_buildapi_builds4h_missing_branch_url,
                                             mock_log_parser):
    """
    Ensure the builds4h job with the missing branch is not ingested
    """
    etl_process = Builds4hJobsProcess()
    etl_process.run()

    assert Job.objects.count() == 0
