from mock import MagicMock

from tests.test_utils import add_log_response
from treeherder.etl.jobs import store_job_data

from treeherder.model.error_summary import get_error_summary
from treeherder.model.models import Job, JobLog, TextLogError


def check_job_log(test_repository, job_guid, parse_status):
    job_logs = JobLog.objects.filter(job__guid=job_guid)
    assert len(job_logs) == 1
    assert job_logs[0].status == parse_status


def test_store_job_with_unparsed_log(
    test_repository, failure_classifications, push_stored, monkeypatch, activate_responses
):
    """
    test submitting a job with an unparsed log parses the log,
    generates an appropriate set of text log steps, and calls
    get_error_summary (to warm the bug suggestions cache)
    """

    # create a wrapper around get_error_summary that records whether
    # it's been called
    mock_get_error_summary = MagicMock(name='get_error_summary', wraps=get_error_summary)
    import treeherder.model.error_summary

    monkeypatch.setattr(treeherder.model.error_summary, 'get_error_summary', mock_get_error_summary)
    log_url = add_log_response("mozilla-central-macosx64-debug-bm65-build1-build15.txt.gz")
    errorsummary = add_log_response("mochitest-browser-chrome_errorsummary.log")

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    job_data = {
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [
                {'url': log_url, 'name': 'live_backing_log', 'parse_status': 'pending'},
                {'url': errorsummary, 'name': 'mochi_errorsummary.log', 'parse_status': 'pending'},
            ],
        },
    }
    store_job_data(test_repository, [job_data])

    # should have 4 errors
    assert TextLogError.objects.count() == 3
    # verify that get_error_summary was called (to warm the bug suggestions
    # cache)
    assert mock_get_error_summary.called
    # should have 3 error summary lines
    assert len(get_error_summary(Job.objects.get(id=1))) == 3


def test_store_job_pending_to_completed_with_unparsed_log(
    test_repository, push_stored, failure_classifications, activate_responses
):
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'

    # the first time, submit it as running (with no logs)
    job_data = {
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {'job_guid': job_guid, 'state': 'running'},
    }
    store_job_data(test_repository, [job_data])
    # should have no text log errors or bug suggestions
    assert TextLogError.objects.count() == 0
    assert get_error_summary(Job.objects.get(guid=job_guid)) == []

    # the second time, post a log that will get parsed
    log_url = add_log_response("mozilla-central-macosx64-debug-bm65-build1-build15.txt.gz")
    job_data = {
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'log_references': [
                {'url': log_url, 'name': 'live_backing_log', 'parse_status': 'pending'}
            ],
        },
    }
    store_job_data(test_repository, [job_data])

    # should have a full set of text log errors
    assert TextLogError.objects.count() == 3
    assert len(get_error_summary(Job.objects.get(guid=job_guid))) == 3


def test_store_job_with_tier(test_repository, failure_classifications, push_stored):
    """test submitting a job with tier specified"""
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    job_data = {
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {'job_guid': job_guid, 'state': 'completed', 'tier': 3},
    }

    store_job_data(test_repository, [job_data])

    job = Job.objects.get(guid=job_guid)
    assert job.tier == 3


def test_store_job_with_default_tier(test_repository, failure_classifications, push_stored):
    """test submitting a job with no tier specified gets default"""
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    job_data = {
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {'job_guid': job_guid, 'state': 'completed'},
    }

    store_job_data(test_repository, [job_data])

    job = Job.objects.get(guid=job_guid)
    assert job.tier == 1
