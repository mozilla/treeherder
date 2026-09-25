from threading import local

import pytest

from treeherder.etl.exceptions import MissingPushError
from treeherder.etl.push import store_push_data
from treeherder.etl.tasks import pulse_tasks
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
        assert isinstance(exc, MissingPushError)
        thread_data.retries += 1
        store_push_data(test_repository, [rs])
        return orig_retry(exc=exc, countdown=countdown)

    monkeypatch.setattr(store_pulse_tasks, "retry", retry_mock)
    store_pulse_tasks.delay(job, "foo", "bar")

    assert Job.objects.count() == 1
    assert Job.objects.values()[0]["guid"] == job["taskId"]
    assert thread_data.retries == 1


def test_store_pulse_tasks_runs_without_current_event_loop(monkeypatch, no_current_event_loop):
    """store_pulse_tasks must drive handle_message without a pre-existing event loop.

    A Celery worker process has no event loop set. Python 3.14 stopped creating one
    implicitly in asyncio.get_event_loop(), which broke task ingestion in production
    (the 3.14 upgrade was reverted in PR #9889 for it).
    """
    pulse_job = {"status": {"taskId": "abc123"}}
    root_url = "https://tc.example.com"
    runs = [{"taskId": "abc123", "runId": 0}, None]
    processed = []

    async def fake_handle_message(message):
        assert message == {"exchange": "ex", "payload": pulse_job, "root_url": root_url}
        return runs

    monkeypatch.setattr(pulse_tasks, "handle_message", fake_handle_message)
    monkeypatch.setattr(
        pulse_tasks.JobLoader,
        "process_job",
        lambda self, run, url: processed.append((run, url)),
    )

    store_pulse_tasks(pulse_job, "ex", "rk", root_url)

    assert processed == [({"taskId": "abc123", "runId": 0}, root_url)]
