import time
import os
import pytest
from treeherder.etl.buildapi import TreeherderBuildapiAdapter


@pytest.fixture
def buildapi_pending_url():
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-pending.js"
    )
    return "file://{0}".format(path)


@pytest.fixture
def buildapi_running_url():
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-running.js"
    )
    return "file://{0}".format(path)


def test_ingest_pending_jobs(jm, buildapi_pending_url, mock_post_json_data):
    """
    a new buildapi pending job creates a new obj in the objectstore
    """
    adapter = TreeherderBuildapiAdapter()
    adapter.process_pending_jobs(buildapi_pending_url)

    stored_obj = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.all")

    assert len(stored_obj) == 1


def test_ingest_running_jobs(jm, buildapi_running_url, mock_post_json_data):
    """
    a new buildapi running job creates a new obj in the objectstore
    """
    adapter = TreeherderBuildapiAdapter()
    adapter.process_running_jobs(buildapi_running_url)

    stored_obj = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.all")

    assert len(stored_obj) == 1
