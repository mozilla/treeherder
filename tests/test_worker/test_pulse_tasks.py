from threading import local

import pytest

from treeherder.etl.job_loader import MissingResultsetException
from treeherder.etl.tasks.pulse_tasks import store_pulse_jobs
from treeherder.model.models import Job


def test_retry_missing_revision_succeeds(sample_data, sample_resultset,
                                         test_project, jm, mock_log_parser,
                                         monkeypatch):
    """
    Ensure that when the missing resultset exists after a retry, that the job
    is then ingested.
    """
    thread_data = local()
    thread_data.retries = 0
    rs = sample_resultset[0]
    job = sample_data.pulse_jobs[0]
    job["origin"]["revision"] = rs["revision"]
    job["origin"]["project"] = test_project

    orig_retry = store_pulse_jobs.retry

    def retry_mock(exc):
        assert isinstance(exc, MissingResultsetException)
        thread_data.retries += 1
        jm.store_result_set_data([rs])
        orig_retry()

    monkeypatch.setattr(store_pulse_jobs, "retry", retry_mock)
    store_pulse_jobs.delay(job, "foo", "bar")

    assert Job.objects.count() == 1
    assert Job.objects.values()[0]["guid"] == job["taskId"]
    assert thread_data.retries == 1


def test_retry_missing_revision_never_succeeds(sample_data, test_project,
                                               jm, mock_log_parser, monkeypatch):
    """
    Ensure that when the missing resultset exists after a retry, that the job
    is then ingested.
    """
    job = sample_data.pulse_jobs[0]
    job["origin"]["project"] = test_project

    with pytest.raises(MissingResultsetException):
        store_pulse_jobs.delay(job, "foo", "bar")

    assert Job.objects.count() == 0
