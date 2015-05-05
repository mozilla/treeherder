# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from mock import MagicMock
import json

from treeherder.client.thclient import client

from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.log_parser.parsers import StepParser
from treeherder.model.derived import JobsModel, ArtifactsModel
from treeherder.model import error_summary


@pytest.fixture
def oauth_treeherder_request(test_project):
    """returns a list of buildapi pending jobs"""
    credentials = OAuthCredentials.get_credentials(test_project)
    req = client.TreeherderRequest(
        protocol='http',
        host='localhost',
        project=test_project,
        oauth_key=credentials['consumer_key'],
        oauth_secret=credentials['consumer_secret']
        )
    return req


@pytest.fixture
def text_log_summary_blob():
    return {
        "header": {},
        "step_data": {
            "all_errors": [
                {"line": "12:34:13     INFO -  Assertion failure: addr % CellSize == 0, at ../../../js/src/gc/Heap.h:1041", "linenumber": 61918},
                {"line": "12:34:24  WARNING -  TEST-UNEXPECTED-FAIL | file:///builds/slave/talos-slave/test/build/tests/jsreftest/tests/jsreftest.html?test=ecma_5/JSON/parse-array-gc.js | Exited with code 1 during test run", "linenumber": 61919}, {"line": "12:34:37  WARNING -  PROCESS-CRASH | file:///builds/slave/talos-slave/test/build/tests/jsreftest/tests/jsreftest.html?test=ecma_5/JSON/parse-array-gc.js | application crashed [@ js::gc::Cell::tenuredZone() const]", "linenumber": 61922},
                {"line": "12:34:38    ERROR - Return code: 256", "linenumber": 64435}
            ],
            "steps": [
                {"name": "Clone gecko tc-vcs "},
                {"name": "Build ./build-b2g-desktop.sh /home/worker/workspace"}
            ],
            "errors_truncated": False
        },
        "logurl": "https://queue.taskcluster.net/v1/task/nhxC4hC3RE6LSVWTZT4rag/runs/0/artifacts/public/logs/live_backing.log"
    }


def test_post_job_with_parsed_log(test_project, result_set_stored,
                                  mock_send_request,
                                  monkeypatch,
                                  oauth_treeherder_request):
    """
    test submitting a job with a pre-parsed log gets job_log_url
    parse_status of "parsed" and does not parse, even though no text_log_summary
    exists.

    This is for the case where they may want to submit it at a later time.
    """

    mock_parse = MagicMock(name="parse_line")
    monkeypatch.setattr(StepParser, 'parse_line', mock_parse)

    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_project,
        'revision_hash': result_set_stored[0]['revision_hash'],
        'job': {
            'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33',
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'builbot_text',
                'parse_status': 'parsed'
            }]
        }
    })

    tjc.add(tj)

    # Post the request to treeherder
    resp = oauth_treeherder_request.post(tjc)
    assert resp.status_int == 200
    assert resp.body == '{"message": "well-formed JSON stored"}'

    with JobsModel(test_project) as jobs_model:
        jobs_model.process_objects(10)
        job_ids = [x['id'] for x in jobs_model.get_job_list(0, 20)]
        job_log_list = jobs_model.get_job_log_url_list(job_ids)

        assert len(job_log_list) == 1
        assert job_log_list[0]['parse_status'] == 'parsed'

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job_ids[0])}
        })

    assert len(artifacts) == 0

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_text_log_summary_artifact_parsed(
        test_project,
        monkeypatch,
        result_set_stored,
        mock_send_request,
        mock_error_summary,
        text_log_summary_blob,
        oauth_treeherder_request):
    """
    test submitting a job with a pre-parsed log gets parse_status of
    "parsed" and doesn't parse the log, but still generates
    the bug suggestions.
    """

    mock_parse = MagicMock(name="parse_line")
    monkeypatch.setattr(StepParser, 'parse_line', mock_parse)

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_project,
        'revision_hash': result_set_stored[0]['revision_hash'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'builbot_text',
                'parse_status': 'parsed'
            }],
            'artifacts': [{
                "blob": json.dumps(text_log_summary_blob),
                "type": "json",
                "name": "text_log_summary",
                "job_guid": job_guid
            }]
        }
    })

    tjc.add(tj)

    # Post the request to treeherder
    resp = oauth_treeherder_request.post(tjc)
    assert resp.status_int == 200
    assert resp.body == '{"message": "well-formed JSON stored"}'

    with JobsModel(test_project) as jobs_model:
        jobs_model.process_objects(10)
        job_id = [x['id'] for x in jobs_model.get_job_list(0, 20)
                  if x['job_guid'] == job_guid][0]
        job_log_list = jobs_model.get_job_log_url_list([job_id])

        assert len(job_log_list) == 1
        assert job_log_list[0]['parse_status'] == 'parsed'

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job_id)}
        })

        artifact_names = {x['name'] for x in artifacts}
        act_bs_obj = [x['blob'] for x in artifacts if x['name'] == 'Bug suggestions'][0]

        assert set(artifact_names) == {'Bug suggestions', 'text_log_summary'}
        assert mock_error_summary == act_bs_obj


def test_post_job_with_text_log_summary_artifact_pending(
        monkeypatch,
        test_project,
        result_set_stored,
        mock_send_request,
        mock_error_summary,
        text_log_summary_blob,
        oauth_treeherder_request):
    """
    test submitting a job with a log set to pending, but with a text_log_summary.

    This should detect the artifact, not parse, and just mark the log as parsed,
    then generate bug suggestions.
    """

    mock_parse = MagicMock(name="parse_line")
    monkeypatch.setattr(StepParser, 'parse_line', mock_parse)

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_project,
        'revision_hash': result_set_stored[0]['revision_hash'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'builbot_text',
                'parse_status': 'pending'
            }],
            'artifacts': [{
                "blob": json.dumps(text_log_summary_blob),
                "type": "json",
                "name": "text_log_summary",
                "job_guid": job_guid
            }]
        }
    })

    tjc.add(tj)

    # Post the request to treeherder
    resp = oauth_treeherder_request.post(tjc)
    assert resp.status_int == 200
    assert resp.body == '{"message": "well-formed JSON stored"}'

    with JobsModel(test_project) as jobs_model:
        jobs_model.process_objects(10)
        job_id = [x['id'] for x in jobs_model.get_job_list(0, 20)
                  if x['job_guid'] == job_guid][0]

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job_id)}
        })

        assert len(artifacts) == 2

        artifact_names = {x['name'] for x in artifacts}
        act_bs_obj = [x['blob'] for x in artifacts if x['name'] == 'Bug suggestions'][0]

    assert set(artifact_names) == {'Bug suggestions', 'text_log_summary'}
    assert mock_error_summary == act_bs_obj

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_text_log_summary_and_bug_suggestions_artifact(
        test_project,
        monkeypatch,
        result_set_stored,
        mock_send_request,
        mock_error_summary,
        text_log_summary_blob,
        oauth_treeherder_request):
    """
    test submitting a job with a pre-parsed log and both artifacts
    does not generate parse the log or generate any artifacts, just uses
    the supplied ones.
    """

    mock_parse = MagicMock(name="parse_line")
    monkeypatch.setattr(StepParser, 'parse_line', mock_parse)
    mock_get_error_summary = MagicMock(name="get_error_summary_artifacts")
    monkeypatch.setattr(error_summary, 'get_error_summary_artifacts', mock_get_error_summary)

    bug_suggestions_blob = ["fee", "fie", "foe", "fum"]

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_project,
        'revision_hash': result_set_stored[0]['revision_hash'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'builbot_text',
                'parse_status': 'parsed'
            }],
            'artifacts': [
                {
                    "blob": json.dumps(text_log_summary_blob),
                    "type": "json",
                    "name": "text_log_summary",
                    "job_guid": job_guid
                },
                {
                    "blob": json.dumps(bug_suggestions_blob),
                    "type": "json",
                    "name": "Bug suggestions",
                    "job_guid": job_guid
                },
            ]
        }
    })

    tjc.add(tj)

    # Post the request to treeherder
    resp = oauth_treeherder_request.post(tjc)
    assert resp.status_int == 200
    assert resp.body == '{"message": "well-formed JSON stored"}'

    with JobsModel(test_project) as jobs_model:
        jobs_model.process_objects(10)
        job_id = [x['id'] for x in jobs_model.get_job_list(0, 20) if x['job_guid'] == job_guid][0]

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job_id)}
        })

        assert len(artifacts) == 2

        artifact_names = {x['name'] for x in artifacts}
        act_bs_obj = [x['blob'] for x in artifacts if x['name'] == 'Bug suggestions'][0]

        assert set(artifact_names) == {'Bug suggestions', 'text_log_summary'}
        assert bug_suggestions_blob == act_bs_obj

    assert mock_parse.called is False
    assert mock_get_error_summary.called is False
