import os

import pytest
import responses
from django.conf import settings
from django.core.cache import cache

from treeherder.etl.buildapi import (CACHE_KEYS,
                                     Builds4hJobsProcess,
                                     PendingJobsProcess,
                                     RunningJobsProcess)


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
    responses.add(responses.GET, settings.BUILDAPI_PENDING_URL,
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
    responses.add(responses.GET, settings.BUILDAPI_RUNNING_URL,
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
    responses.add(responses.GET, settings.BUILDAPI_BUILDS4H_URL,
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
    responses.add(responses.GET, settings.BUILDAPI_BUILDS4H_URL,
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
    responses.add(responses.GET, settings.BUILDAPI_BUILDS4H_URL,
                  body=mocked_content, status=200,
                  content_type='application/json')


def test_ingest_pending_jobs(jm,
                             result_set_stored,
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

    stored_obj = jm.get_dhub().execute(proc="jobs_test.selects.jobs")
    assert len(stored_obj) == 1


def test_ingest_running_jobs(jm,
                             result_set_stored,
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

    stored_obj = jm.get_dhub().execute(proc="jobs_test.selects.jobs")
    assert len(stored_obj) == 1


def test_ingest_builds4h_jobs(jm,
                              result_set_stored,
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

    stored_obj = jm.get_dhub().execute(proc="jobs_test.selects.jobs")
    assert len(stored_obj) == 32


def test_ingest_running_to_complete_job(jm,
                                        result_set_stored,
                                        mock_buildapi_running_url,
                                        mock_buildapi_builds4h_url,
                                        mock_log_parser):
    """
    a new buildapi running job transitions to a new completed job

    """
    etl_process = RunningJobsProcess()
    etl_process.run()

    stored_running = jm.get_dhub().execute(proc="jobs_test.selects.jobs")

    assert len(stored_running) == 1

    # the first job in the sample data should overwrite the running job
    # we just ingested.  Leaving us with only 32 jobs, not 33.
    etl_process = Builds4hJobsProcess()
    etl_process.run()

    stored_obj = jm.get_dhub().execute(proc="jobs_test.selects.jobs")

    assert len(stored_obj) == 32

    # all jobs should be completed, including the original one which
    # transitioned from running.
    for job in stored_obj:
        assert job['state'] == 'completed'


def test_ingest_running_job_fields(jm,
                                   result_set_stored,
                                   mock_buildapi_running_url,
                                   mock_log_parser):
    """
    a new buildapi running job creates a new obj in the job table
    """
    etl_process = RunningJobsProcess()
    etl_process.run()

    stored_obj = jm.get_dhub().execute(proc="jobs_test.selects.jobs")

    assert len(stored_obj) == 1
    assert stored_obj[0]["start_timestamp"] is not 0


def test_ingest_builds4h_jobs_1_missing_resultset(jm,
                                                  result_set_stored,
                                                  mock_buildapi_builds4h_missing1_url,
                                                  mock_log_parser):
    """
    Ensure the builds4h job with the missing resultset is not ingested
    """
    etl_process = Builds4hJobsProcess()
    etl_process.run()

    stored_obj = jm.get_dhub().execute(proc="jobs_test.selects.jobs")
    assert len(stored_obj) == 1


def test_ingest_builds4h_jobs_missing_branch(jm,
                                             result_set_stored,
                                             mock_buildapi_builds4h_missing_branch_url,
                                             mock_log_parser):
    """
    Ensure the builds4h job with the missing branch is not ingested
    """
    etl_process = Builds4hJobsProcess()
    etl_process.run()

    stored_obj = jm.get_dhub().execute(proc="jobs_test.selects.jobs")
    assert len(stored_obj) == 0
