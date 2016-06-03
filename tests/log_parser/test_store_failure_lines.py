import pytest
import responses
from django.conf import settings
from requests.exceptions import HTTPError

from treeherder.log_parser.failureline import (char_to_codepoint_ucs2,
                                               store_failure_lines)
from treeherder.model.models import (FailureLine,
                                     Job,
                                     JobLog)
from treeherder.model.search import TestFailureLine

from ..sampledata import SampleData


def test_store_error_summary(activate_responses, test_repository, jm, eleven_jobs_stored):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = 'http://my-log.mozilla.org'

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=200)

    job = Job.objects.get(guid=jm.get_job(1)[0]['job_guid'])

    log_obj = JobLog.objects.create(job=job, name="errorsummary_json", url=log_url)

    store_failure_lines(jm.project, job.guid, log_obj)

    assert FailureLine.objects.count() == 1

    failure = FailureLine.objects.get(pk=1)

    assert failure.job_guid == job.guid

    assert failure.repository == test_repository


def test_store_error_summary_truncated(activate_responses, test_repository, jm,
                                       eleven_jobs_stored, monkeypatch):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary_10_lines.log")
    log_url = 'http://my-log.mozilla.org'

    monkeypatch.setattr(settings, 'FAILURE_LINES_CUTOFF', 5)

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=200)

    job = Job.objects.get(guid=jm.get_job(1)[0]['job_guid'])

    log_obj = JobLog.objects.create(job=job, name="errorsummary_json", url=log_url)

    store_failure_lines(jm.project, job.guid, log_obj)

    assert FailureLine.objects.count() == 5 + 1

    failure = FailureLine.objects.get(action='truncated')

    assert failure.job_guid == job.guid

    assert failure.repository == test_repository


def test_store_error_summary_astral(activate_responses, test_repository, jm,
                                    eleven_jobs_stored):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary_astral.log")
    log_url = 'http://my-log.mozilla.org'

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url, content_type="text/plain;charset=utf-8",
                      body=log_handler.read(), status=200)

    job = Job.objects.get(guid=jm.get_job(1)[0]['job_guid'])

    log_obj = JobLog.objects.create(job=job, name="errorsummary_json", url=log_url)

    store_failure_lines(jm.project, job.guid, log_obj)

    assert FailureLine.objects.count() == 1

    failure = FailureLine.objects.get(pk=1)

    assert failure.job_guid == job.guid

    assert failure.repository == test_repository

    assert failure.test == u"toolkit/content/tests/widgets/test_videocontrols_video_direction.html <U+01F346>"
    assert failure.subtest == u"Test timed out. <U+010081>"
    assert failure.message == u"<U+0F0151>"
    assert failure.stack.endswith("<U+0F0151>")
    assert failure.stackwalk_stdout is None
    assert failure.stackwalk_stderr is None


def test_store_error_summary_404(activate_responses, test_repository, jm, eleven_jobs_stored):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = 'http://my-log.mozilla.org'

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=404)

    job = Job.objects.get(guid=jm.get_job(1)[0]['job_guid'])

    log_obj = JobLog.objects.create(job=job, name="errorsummary_json", url=log_url)

    store_failure_lines(jm.project, job.guid, log_obj)

    log_obj.refresh_from_db()
    assert log_obj.status == JobLog.FAILED


def test_store_error_summary_500(activate_responses, test_repository, jm, eleven_jobs_stored):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = 'http://my-log.mozilla.org'

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=500)

    job = Job.objects.get(guid=jm.get_job(1)[0]['job_guid'])

    log_obj = JobLog.objects.create(job=job, name="errorsummary_json", url=log_url)

    with pytest.raises(HTTPError):
        store_failure_lines(jm.project, job.guid, log_obj)

    log_obj.refresh_from_db()
    assert log_obj.status == JobLog.FAILED


def test_char_data_to_codepoint_ucs2():
    # Unbelivably, putting the two codepoints in a string seems to cause them to be
    # interpreted as a single character, but only in unit tests, and only sometimes.
    # Since we only use indexing operations, putting the codepoints in a tuple is
    # equivalent to a lenth 2 string.
    data = [
        ((u"\ud800", u"\udc00"), 0x010000),
        ((u"\udbff", u"\udfff"), 0x10FFFF),
        ((u"\uda00", u"\uddff"), 0x0901ff),
    ]
    for value, expected in data:
        assert char_to_codepoint_ucs2(value) == expected


def test_store_error_summary_elastic_search(activate_responses, test_repository,
                                            jm, eleven_jobs_stored, elasticsearch):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = 'http://my-log.mozilla.org'

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=200)

    job = Job.objects.get(guid=jm.get_job(1)[0]['job_guid'])

    log_obj = JobLog.objects.create(job=job, name="errorsummary_json", url=log_url)

    store_failure_lines(jm.project, job.guid, log_obj)

    assert FailureLine.objects.count() == 1

    failure = FailureLine.objects.get(pk=1)

    es_line = TestFailureLine.get(1, routing=failure.test)
    for prop in ["test", "subtest", "status", "expected"]:
        assert getattr(es_line, prop) == getattr(failure, prop)
    assert es_line.best_classification is None
    assert es_line.best_is_verified is False
