import os
import pytest
import responses
import json

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
def mock_buildapi_pending_missing1_url(monkeypatch):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data",
        "builds-pending-missing1.js"
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

    jm.disconnect()

    assert len(stored_obj) == 1


def test_ingest_pending_jobs_1_missing_resultset(jm, initial_data, sample_resultset,
                                test_repository,
                                mock_buildapi_pending_missing1_url,
                                mock_post_json_data,
                                mock_get_resultset,
                                mock_get_remote_content,
                                activate_responses):
    """
    Ensure the job with the missing resultset is queued for refetching
    """
    new_revision = '222222222222'
    pushlog_content = json.dumps(
        {"33270": {
            "date": 1378288232,
            "changesets": [
                {
                    "node": new_revision + "b344655ed7be9a408d2970a736c4",
                    "files": [
                        "browser/base/content/browser.js"
                    ],
                    "tags": [],
                    "author": "John Doe <jdoe@mozilla.com>",
                    "branch": "default",
                    "desc": "bug 909264 - control characters"
                }
            ],
            "user": "jdoe@mozilla.com"
        }}
    )
    pushlog_fake_url = "https://hg.mozilla.org/mozilla-central/json-pushes/?full=1&changeset=" + new_revision
    responses.add(responses.GET, pushlog_fake_url,
                  body=pushlog_content, status=200,
                  match_querystring=True,
                  content_type='application/json')

    from treeherder.etl.buildapi import PendingJobsProcess
    etl_process = PendingJobsProcess()
    etl_process.run()

    stored_obj = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.jobs")

    assert len(stored_obj) == 1

    revisions_stored = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.revision_ids",
        return_type='tuple'
    )

    assert len(revisions_stored) == 20
    was_stored = False
    for rs in revisions_stored:
        if str(rs['revision']) == new_revision:
            was_stored = True
    assert was_stored

    jm.disconnect()


def test_ingest_running_jobs(jm, initial_data,
                                mock_buildapi_running_url,
                                mock_post_json_data,
                                mock_log_parser,
                                mock_get_resultset,
                                mock_get_remote_content):
    """
    a new buildapi running job creates a new obj in the job table
    """
    from treeherder.etl.buildapi import RunningJobsProcess
    etl_process = RunningJobsProcess()
    etl_process.run()

    stored_obj = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.jobs")

    jm.disconnect()

    assert len(stored_obj) == 1


def test_ingest_running_job_fields(jm, initial_data,
                                mock_buildapi_running_url,
                                mock_post_json_data,
                                mock_log_parser,
                                mock_get_resultset,
                                mock_get_remote_content):
    """
    a new buildapi running job creates a new obj in the job table
    """
    from treeherder.etl.buildapi import RunningJobsProcess
    etl_process = RunningJobsProcess()
    etl_process.run()

    stored_obj = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.jobs")

    jm.disconnect()

    assert len(stored_obj) == 1
    assert stored_obj[0]["start_timestamp"] is not 0

