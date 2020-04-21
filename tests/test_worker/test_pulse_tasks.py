from threading import local

import pytest

from treeherder.etl.exceptions import MissingPushException
from treeherder.etl.push import store_push_data
from treeherder.etl.tasks.pulse_tasks import store_pulse_tasks
from treeherder.model.models import Job


@pytest.mark.skip("Test needs fixing in bug: 1307289 (plus upgrade from jobs to tasks)")
def test_retry_missing_revision_succeeds(
    sample_data, sample_push, test_repository, mock_log_parser, monkeypatch
):
    """
    Ensure that when the missing push exists after a retry, that the job
    is then ingested.
    """
    thread_data = local()
    thread_data.retries = 0
    rs = sample_push[0]
    job = sample_data.pulse_jobs[0]
    job["origin"]["revision"] = rs["revision"]
    job["origin"]["project"] = test_repository.name

    orig_retry = store_pulse_tasks.retry

    def retry_mock(exc=None, countdown=None):
        assert isinstance(exc, MissingPushException)
        thread_data.retries += 1
        store_push_data(test_repository, [rs])
        return orig_retry(exc=exc, countdown=countdown)

    monkeypatch.setattr(store_pulse_tasks, "retry", retry_mock)
    store_pulse_tasks.delay(job, "foo", "bar")

    assert Job.objects.count() == 1
    assert Job.objects.values()[0]["guid"] == job["taskId"]
    assert thread_data.retries == 1
