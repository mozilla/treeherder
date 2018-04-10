import datetime
import json

import pytest
from django.forms import model_to_dict
from mock import MagicMock

from tests.test_utils import (add_log_response,
                              post_collection)
from treeherder.client.thclient import client
from treeherder.log_parser.parsers import StepParser
from treeherder.model.error_summary import get_error_summary
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
                     {"line": "12:34:24  WARNING -  TEST-UNEXPECTED-FAIL | file:///builds/slave/talos-slave/test/build/tests/jsreftest/tests/jsreftest.html?test=ecma_5/JSON/parse-array-gc.js | Exited with code 1 during test run", "linenumber": 61919},
                     {"line": "12:34:37  WARNING -  PROCESS-CRASH | file:///builds/slave/talos-slave/test/build/tests/jsreftest/tests/jsreftest.html?test=ecma_5/JSON/parse-array-gc.js | application crashed [@ js::gc::Cell::tenuredZone() const]", "linenumber": 61922},
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


def check_job_log(test_repository, job_guid, parse_status):
    job_logs = JobLog.objects.filter(job__guid=job_guid)
    assert len(job_logs) == 1
    assert job_logs[0].status == parse_status


def test_post_job_with_unparsed_log(test_repository, failure_classifications,
                                    push_stored, mock_post_json,
                                    monkeypatch, activate_responses):
    """
    test submitting a job with an unparsed log parses the log,
    generates an appropriate set of text log steps, and calls
    get_error_summary (to warm the bug suggestions cache)
    """

    # create a wrapper around get_error_summary that records whether
    # it's been called
    mock_get_error_summary = MagicMock(name='get_error_summary',
                                       wraps=get_error_summary)
    import treeherder.model.error_summary
    monkeypatch.setattr(treeherder.model.error_summary, 'get_error_summary',
                        mock_get_error_summary)
    log_url = add_log_response("mozilla-central-macosx64-debug-bm65-build1-build15.txt.gz")

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': log_url,
                'name': 'buildbot_text',
                'parse_status': 'pending'
            }]
        }
    })
    tjc.add(tj)
    post_collection(test_repository.name, tjc)

    # should have 2 errors
    assert TextLogError.objects.count() == 2
    # verify that get_error_summary was called (to warm the bug suggestions
    # cache)
    assert mock_get_error_summary.called
    # should have 2 error summary lines (aka bug suggestions)
    assert len(get_error_summary(Job.objects.get(id=1))) == 2


def test_post_job_pending_to_completed_with_unparsed_log(test_repository,
                                                         push_stored,
                                                         failure_classifications,
                                                         activate_responses,
                                                         mock_post_json):

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'

    # the first time, submit it as running (with no logs)
    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'running'
        }
    })
    tjc.add(tj)
    post_collection(test_repository.name, tjc)
    # should have no text log errors or bug suggestions
    assert TextLogError.objects.count() == 0
    assert get_error_summary(Job.objects.get(guid=job_guid)) == []

    # the second time, post a log that will get parsed
    log_url = add_log_response("mozilla-central-macosx64-debug-bm65-build1-build15.txt.gz")
    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [{
                'url': log_url,
                'name': 'buildbot_text',
                'parse_status': 'pending'
            }]
        }
    })
    tjc.add(tj)
    post_collection(test_repository.name, tjc)

    # should have a full set of text log errors
    assert TextLogError.objects.count() == 2
    assert len(get_error_summary(Job.objects.get(guid=job_guid))) == 2


def test_post_job_with_parsed_log(test_repository, push_stored,
                                  failure_classifications,
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
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
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

    post_collection(test_repository.name, tjc)

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_text_log_summary_artifact_parsed(
        test_repository,
        failure_classifications,
        push_stored,
        monkeypatch,
        mock_post_json,
        text_log_summary_dict,
        ):
    """
    test submitting a job with a pre-parsed log gets parse_status of
    "parsed" and doesn't parse the log, but we get the expected set of
    text log steps/errors and bug suggestions.
    """

    mock_parse = MagicMock(name="parse_line")
    monkeypatch.setattr(StepParser, 'parse_line', mock_parse)

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
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

    post_collection(test_repository.name, tjc)

    # should have 4 error summary lines (aka bug suggestions)
    assert len(get_error_summary(Job.objects.get(guid=job_guid))) == 4

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_text_log_summary_artifact_pending(
        test_repository,
        failure_classifications,
        push_stored,
        monkeypatch,
        mock_post_json,
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
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
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

    post_collection(test_repository.name, tjc)

    # should have 4 error summary lines (aka bug suggestions)
    assert len(get_error_summary(Job.objects.get(guid=job_guid))) == 4

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_artifacts_by_add_artifact(
        test_repository,
        failure_classifications,
        push_stored,
        monkeypatch,
        mock_post_json,
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
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
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

    post_collection(test_repository.name, tjc)

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
    text_log_error = TextLogError.objects.get(step__job__guid=job_guid)
    assert model_to_dict(text_log_error) == {
        'id': 1,
        'line': 'TEST_UNEXPECTED_FAIL | /sdcard/tests/autophone/s1s2test/nytimes.com/index.html | Failed to get uncached measurement.',
        'line_number': 64435,
        'step': 1,
    }

    # assert that some bug suggestions got generated
    assert len(get_error_summary(Job.objects.get(guid=job_guid))) == 1

    check_job_log(test_repository, job_guid, JobLog.PARSED)

    # ensure the parsing didn't happen
    assert mock_parse.called is False


def test_post_job_with_tier(test_repository, failure_classifications,
                            push_stored,
                            mock_post_json):
    """test submitting a job with tier specified"""

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
        }
    })
    tj.add_tier(3)
    tjc.add(tj)

    post_collection(test_repository.name, tjc)

    job = Job.objects.get(guid=job_guid)
    assert job.tier == 3


def test_post_job_with_default_tier(test_repository, failure_classifications,
                                    push_stored,
                                    mock_post_json):
    """test submitting a job with no tier specified gets default"""

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
        }
    })
    tjc.add(tj)

    post_collection(test_repository.name, tjc)

    job = Job.objects.get(guid=job_guid)
    assert job.tier == 1


def test_post_job_with_buildapi_artifact(test_repository, failure_classifications,
                                         push_stored,
                                         mock_post_json):
    """
    test submitting a job with a buildapi artifact gets that stored (and
    we update the job object)
    """
    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'artifacts': [],
            'job_guid': job_guid,
            'state': 'completed',
        }
    })
    tj.add_artifact("buildapi", "json",
                    json.dumps({"buildername": "Windows 8 64-bit cheezburger",
                                "request_id": 1234}))
    tjc.add(tj)
    post_collection(test_repository.name, tjc)

    assert Job.objects.count() == 1
    assert JobDetail.objects.count() == 1

    buildbot_request_id_detail = JobDetail.objects.all()[0]
    assert buildbot_request_id_detail.title == 'buildbot_request_id'
    assert buildbot_request_id_detail.value == str(1234)
    assert buildbot_request_id_detail.url is None
