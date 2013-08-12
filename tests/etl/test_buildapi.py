import os
import pytest
from treeherder.etl.buildapi import PendingJobsProcess, RunningJobsProcess
from django.conf import settings


@pytest.fixture
def mock_buildapi_pending_url():
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-pending.js"
    )
    original_url = settings.BUILDAPI_PENDING_URL
    settings.BUILDAPI_PENDING_URL = "file://{0}".format(path)
    #on tearDown reset the original url
    def fin():
        settings.BUILDAPI_PENDING_URL = original_url


@pytest.fixture
def mock_buildapi_running_url():
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-running.js"
    )
    original_url = settings.BUILDAPI_RUNNING_URL
    settings.BUILDAPI_RUNNING_URL = "file://{0}".format(path)
    #on tearDown reset the original url
    def fin():
        settings.BUILDAPI_PENDING_URL = original_url


def test_ingest_pending_jobs(jm, mock_buildapi_pending_url, mock_post_json_data):
    """
    a new buildapi pending job creates a new obj in the objectstore
    """
    etl_process = PendingJobsProcess()
    etl_process.run()

    stored_obj = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.all")

    assert len(stored_obj) == 1


def test_ingest_running_jobs(jm, mock_buildapi_running_url, mock_post_json_data):
    """
    a new buildapi running job creates a new obj in the objectstore
    """
    etl_process = RunningJobsProcess()
    etl_process.run()

    stored_obj = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.all")

    assert len(stored_obj) == 1
