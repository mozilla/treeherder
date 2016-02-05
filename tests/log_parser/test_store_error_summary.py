import responses
from django.conf import settings
from django.core.management import call_command

from treeherder.model.models import FailureLine

from ..sampledata import SampleData


def test_store_error_summary(activate_responses, test_repository, jm,
                             eleven_jobs_stored):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary.log")
    log_url = 'http://my-log.mozilla.org'

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=200)

    job = jm.get_job(1)[0]

    jm._insert_log_urls([[job["id"], "errorsummary_json", log_url, "pending"]])

    call_command('store_error_summary', jm.project, job['job_guid'], log_url)

    assert FailureLine.objects.count() == 1

    failure = FailureLine.objects.get(pk=1)

    assert failure.job_guid == job['job_guid']

    assert failure.repository == test_repository


def test_store_error_summary_truncated(activate_responses, test_repository,
                                       jm, eleven_jobs_stored, monkeypatch):
    log_path = SampleData().get_log_path("plain-chunked_errorsummary_10_lines.log")
    log_url = 'http://my-log.mozilla.org'

    monkeypatch.setattr(settings, 'FAILURE_LINES_CUTOFF', 5)

    with open(log_path) as log_handler:
        responses.add(responses.GET, log_url,
                      body=log_handler.read(), status=200)

    job = jm.get_job(1)[0]

    jm._insert_log_urls([[job["id"], "errorsummary_json", log_url, "pending"]])

    call_command('store_error_summary', jm.project, job['job_guid'], log_url)

    assert FailureLine.objects.count() == 5 + 1

    failure = FailureLine.objects.get(action='truncated')

    assert failure.job_guid == job['job_guid']

    assert failure.repository == test_repository
