import datetime
import json

import pytest
from django.forms import model_to_dict
from mock import MagicMock

from tests.test_utils import post_collection
from treeherder.client.thclient import client
from treeherder.log_parser.parsers import StepParser
from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)
from treeherder.model.models import (Job,
                                     JobDetail,
                                     JobLog,
                                     TextLogError,
                                     TextLogStep)


@pytest.fixture
def text_log_summary_dict():
    return {
        "step_data": {
            "steps": [
                {"name": "Clone gecko tc-vcs ",
                 "started_linenumber": 1,
                 "finished_linenumber": 100000,
                 "started": "2016-07-13 16:09:31",
                 "finished": "2016-07-13 16:09:31",
                 "result": "testfailed",
                 "errors": [
                     {"line": "12:34:13     INFO -  Assertion failure: addr % CellSize == 0, at ../../../js/src/gc/Heap.h:1041", "linenumber": 61918},
                     {"line": "12:34:24  WARNING -  TEST-UNEXPECTED-FAIL | file:///builds/slave/talos-slave/test/build/tests/jsreftest/tests/jsreftest.html?test=ecma_5/JSON/parse-array-gc.js | Exited with code 1 during test run", "linenumber": 61919}, {"line": "12:34:37  WARNING -  PROCESS-CRASH | file:///builds/slave/talos-slave/test/build/tests/jsreftest/tests/jsreftest.html?test=ecma_5/JSON/parse-array-gc.js | application crashed [@ js::gc::Cell::tenuredZone() const]", "linenumber": 61922},
                     {"line": "12:34:38    ERROR - Return code: 256", "linenumber": 64435}
                 ]},
                {"name": "Build ./build-b2g-desktop.sh /home/worker/workspace", "started_linenumber": 1, "finished_linenumber": 1, "result": "success",
                 "started": "2016-07-13 16:09:31",
                 "finished": "2016-07-13 16:09:31"}
            ],
            "errors_truncated": False
        },
        "logurl": "https://queue.taskcluster.net/v1/task/nhxC4hC3RE6LSVWTZT4rag/runs/0/artifacts/public/logs/live_backing.log"
    }


def check_artifacts(test_project,
                    job_guid,
                    parse_status,
                    num_artifacts,
                    exp_artifact_names=None,
                    exp_error_summary=None):

    job_logs = JobLog.objects.filter(job__guid=job_guid)
    assert len(job_logs) == 1
    assert job_logs[0].status == parse_status

    with ArtifactsModel(test_project) as artifacts_model:
        job_id = Job.objects.values_list('project_specific_id').get(
            guid=job_guid)

        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job_id)}
        })

        assert len(artifacts) == num_artifacts

        if exp_artifact_names:
            artifact_names = {x['name'] for x in artifacts}
            assert set(artifact_names) == exp_artifact_names

        if exp_error_summary:
            act_bs_obj = [x['blob'] for x in artifacts if x['name'] == 'Bug suggestions'][0]
            assert exp_error_summary == act_bs_obj


def test_post_job_with_parsed_log(test_project, result_set_stored,
                                  mock_post_json,
                                  monkeypatch,
                                  ):
    """
    test submitting a job with a pre-parsed log gets job_log_url
    parse_status of "parsed" and does not parse, even though no text_log_summary
    exists.

    This is for the case where they may want to submit it at a later time.
    """

    mock_parse = MagicMock(name="parse_line")
    monkeypatch.setattr(StepParser, 'parse_line', mock_parse)

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_project,
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'buildbot_text',
                'parse_status': 'parsed'
            }]
        }
    })
    tjc.add(tj)

    post_collection(test_project, tjc)

    check_artifacts(test_project, job_guid, JobLog.PARSED, 0)

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_text_log_summary_artifact_parsed(
        test_project,
        monkeypatch,
        result_set_stored,
        mock_post_json,
        mock_error_summary,
        text_log_summary_dict,
        ):
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
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'buildbot_text',
                'parse_status': 'parsed'
            }],
            'artifacts': [{
                "blob": json.dumps(text_log_summary_dict),
                "type": "json",
                "name": "text_log_summary",
                "job_guid": job_guid
            }]
        }
    })
    tjc.add(tj)

    post_collection(test_project, tjc)

    check_artifacts(test_project, job_guid, JobLog.PARSED, 2,
                    {'Bug suggestions', 'text_log_summary'}, mock_error_summary)

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_text_log_summary_artifact_parsed_dict_blob(
        test_project,
        monkeypatch,
        result_set_stored,
        mock_post_json,
        mock_error_summary,
        text_log_summary_dict,
        ):
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
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'buildbot_text',
                'parse_status': 'parsed'
            }],
            'artifacts': [{
                "blob": text_log_summary_dict,
                "type": "json",
                "name": "text_log_summary",
                "job_guid": job_guid
            }]
        }
    })
    tjc.add(tj)

    post_collection(test_project, tjc)

    check_artifacts(test_project, job_guid, JobLog.PARSED, 2,
                    {'Bug suggestions', 'text_log_summary'}, mock_error_summary)

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_text_log_summary_artifact_pending(
        test_project,
        monkeypatch,
        result_set_stored,
        mock_post_json,
        mock_error_summary,
        text_log_summary_dict,
        ):
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
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'buildbot_text',
                'parse_status': 'pending'
            }],
            'artifacts': [{
                "blob": json.dumps(text_log_summary_dict),
                "type": "json",
                "name": "text_log_summary",
                "job_guid": job_guid
            }]
        }
    })

    tjc.add(tj)

    post_collection(test_project, tjc)

    check_artifacts(test_project, job_guid, JobLog.PARSED, 2,
                    {'Bug suggestions', 'text_log_summary'}, mock_error_summary)

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_artifacts_by_add_artifact(
        test_project,
        monkeypatch,
        result_set_stored,
        mock_post_json,
        mock_error_summary,
        ):
    """
    test submitting a job with artifacts added by ``add_artifact``

    This has pre-parsed logs.  Verify parse_status of "parsed" and that it
    doesn't parse the logs.

    Submitted ``text_log_artifact`` should still trigger generation of the
    bug suggestions.
    """

    mock_parse = MagicMock(name="parse_line")
    monkeypatch.setattr(StepParser, 'parse_line', mock_parse)

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_project,
        'revision': result_set_stored[0]['revision'],
        "job": {
            "artifacts": [],
            "job_guid": job_guid,
            "log_references": [
                {
                    "name": "autophone-nexus-one-1.log",
                    "parse_status": "parsed",
                    "url": "https://autophone-dev.s3.amazonaws.com/pub/mozilla.org/mobile/tinderbox-builds/mozilla-inbound-android-api-9/1432676531/en-US/autophone-autophone-s1s2-s1s2-nytimes-local.ini-1-nexus-one-1.log"
                }
            ],
            "state": "completed",
        },
    })

    tls_blob = json.dumps({
        "logurl": "https://autophone-dev.s3.amazonaws.com/pub/mozilla.org/mobile/tinderbox-builds/mozilla-inbound-android-api-9/1432676531/en-US/autophone-autophone-s1s2-s1s2-nytimes-local.ini-1-nexus-one-1.log",
        "step_data": {
            "all_errors": [
            ],
            "steps": [{
                "name": "foobar",
                "result": "testfailed",
                "started_linenumber": 1,
                "finished_linenumber": 100000,
                "started": "2016-07-13 16:09:31",
                "finished": "2016-07-13 16:09:31",
                "errors": [
                    {"line": "TEST_UNEXPECTED_FAIL | /sdcard/tests/autophone/s1s2test/nytimes.com/index.html | Failed to get uncached measurement.", "linenumber": 64435}
                ]
            }]
        }
    })

    ji_blob = json.dumps({"job_details": [{"title": "mytitle",
                                           "value": "myvalue"}]})
    bapi_blob = json.dumps({"buildername": "merd"})
    pb_blob = json.dumps({"build_url": "feh", "chunk": 1, "config_file": "mah"})

    tj.add_artifact("text_log_summary", "json", tls_blob)
    tj.add_artifact("Job Info", "json", ji_blob)
    tj.add_artifact("buildapi", "json", bapi_blob)
    tj.add_artifact("privatebuild", "json", pb_blob)

    tjc.add(tj)

    post_collection(test_project, tjc)

    assert JobDetail.objects.count() == 1
    assert model_to_dict(JobDetail.objects.get(job__guid=job_guid)) == {
        'id': 1,
        'job': 1,
        'title': 'mytitle',
        'value': 'myvalue',
        'url': None
    }

    assert TextLogStep.objects.count() == 1
    assert model_to_dict(TextLogStep.objects.get(job__guid=job_guid)) == {
        'id': 1,
        'job': 1,
        'started': datetime.datetime(2016, 7, 13, 16, 9, 31),
        'finished': datetime.datetime(2016, 7, 13, 16, 9, 31),
        'name': 'foobar',
        'result': 1,
        'started_line_number': 1,
        'finished_line_number': 100000
    }

    assert TextLogError.objects.count() == 1
    assert model_to_dict(TextLogError.objects.get(step__job__guid=job_guid)) == {
        'id': 1,
        'line': 'TEST_UNEXPECTED_FAIL | /sdcard/tests/autophone/s1s2test/nytimes.com/index.html | Failed to get uncached measurement.',
        'line_number': 64435,
        'step': 1
    }

    check_artifacts(test_project, job_guid, JobLog.PARSED, 4,
                    {'Bug suggestions', 'text_log_summary',
                     'privatebuild', 'buildapi'}, mock_error_summary)

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_tier(test_project, result_set_stored,
                            mock_post_json):
    """test submitting a job with tier specified"""

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_project,
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
        }
    })
    tj.add_tier(3)
    tjc.add(tj)

    post_collection(test_project, tjc)

    with JobsModel(test_project) as jobs_model:
        job = [x for x in jobs_model.get_job_list(0, 20)
               if x['job_guid'] == job_guid][0]
        assert job['tier'] == 3


def test_post_job_with_default_tier(test_project, result_set_stored,
                                    mock_post_json):
    """test submitting a job with no tier specified gets default"""

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_project,
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
        }
    })
    tjc.add(tj)

    post_collection(test_project, tjc)

    with JobsModel(test_project) as jobs_model:
        job = [x for x in jobs_model.get_job_list(0, 20)
               if x['job_guid'] == job_guid][0]
        assert job['tier'] == 1
