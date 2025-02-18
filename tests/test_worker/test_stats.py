from datetime import timedelta
from unittest.mock import MagicMock, call, patch

import pytest
from django.utils import timezone

from treeherder.model.models import Job, Push
from treeherder.workers.stats import publish_stats


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats_nothing_to_do(get_worker_mock, django_assert_num_queries, caplog):
    statsd_client = MagicMock()
    get_worker_mock.return_value = statsd_client
    assert Push.objects.count() == 0
    assert Job.objects.count() == 0
    with django_assert_num_queries(2):
        publish_stats()
    assert [(level, message) for _, level, message in caplog.record_tuples] == [
        (20, "Publishing runtime statistics to statsd"),
        (20, "Ingested 0 pushes"),
        (20, "Ingested 0 jobs in total"),
    ]
    assert statsd_client.call_args_list == []


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats(
    get_worker_mock, eleven_jobs_stored_new_date, django_assert_num_queries, caplog, settings
):
    "Test statsd statistics publication task"
    settings.CELERY_STATS_PUBLICATION_DELAY = 10
    statsd_client = MagicMock()
    get_worker_mock.return_value = statsd_client
    assert Push.objects.count() == 22
    assert Job.objects.count() == 11
    Push.objects.update(time=timezone.now() - timedelta(minutes=10))
    Job.objects.update(end_time=timezone.now() - timedelta(minutes=10))

    with django_assert_num_queries(2):
        publish_stats()
    assert [(level, message) for _, level, message in caplog.record_tuples] == [
        (20, "Publishing runtime statistics to statsd"),
        (20, "Ingested 22 pushes"),
        (20, "Ingested 11 jobs in total"),
    ]
    assert statsd_client.incr.call_args_list == [
        call("push", 22),
        call("jobs", 11),
        call("jobs_repo.mozilla-central", 11),
        call("jobs_state.completed", 11),
    ]
