import os
import pytest
from django.conf import settings


@pytest.fixture
def mock_buildapi_pending_url(monkeypatch):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-pending.js"
    )
    monkeypatch.setattr(settings,
                        'BUILDAPI_PENDING_URL',
                        "file://{0}".format(path))


@pytest.fixture
def mock_buildapi_running_url(monkeypatch):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-running.js"
    )
    monkeypatch.setattr(settings,
                        'BUILDAPI_RUNNING_URL',
                        "file://{0}".format(path))


@pytest.fixture
def mock_buildapi_builds4h_url(monkeypatch):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-4h.js"
    )
    monkeypatch.setattr(settings,
                        'BUILDAPI_BUILDS4H_URL',
                        "file://{0}".format(path))


def test_ingest_pending_jobs(jm, initial_data,
                                mock_buildapi_pending_url,
                                mock_post_json_data,
                                mock_log_parser,
                                mock_get_resultset,
                                mock_get_remote_content):
    """
    a new buildapi pending job creates a new obj in the job table
    """
    from treeherder.etl.buildapi import PendingJobsProcess
    etl_process = PendingJobsProcess()
    etl_process.run()

    stored_obj = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.jobs")

    assert len(stored_obj) == 1

