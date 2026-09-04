from datetime import timedelta
from unittest.mock import MagicMock, call, patch

import pytest
from django.utils import timezone

from treeherder.model.models import Job, Push
from treeherder.workers.stats import get_stats_client, publish_stats


def _get_window(delay_minutes=10):
    now = timezone.now()
    end_date = now - timedelta(
        minutes=now.minute % delay_minutes,
        seconds=now.second,
        microseconds=now.microsecond,
    )
    start_date = end_date - timedelta(minutes=delay_minutes)
    return start_date, end_date


def _create_job(guid, push, generic_reference_data, state="completed", end_time=None):
    if end_time is None:
        end_time = push.time
    return Job.objects.create(
        guid=guid,
        repository=push.repository,
        push=push,
        signature=generic_reference_data.signature,
        build_platform=generic_reference_data.build_platform,
        machine_platform=generic_reference_data.machine_platform,
        machine=generic_reference_data.machine,
        option_collection_hash=generic_reference_data.option_collection_hash,
        job_type=generic_reference_data.job_type,
        job_group=generic_reference_data.job_group,
        product=generic_reference_data.product,
        failure_classification_id=1,
        who="testuser@foo.com",
        reason="success",
        result="completed" if state == "completed" else "unknown",
        state=state,
        submit_time=push.time,
        start_time=push.time,
        end_time=end_time,
        tier=1,
    )


@patch("statsd.StatsClient")
def test_get_stats_client(mock_statsd_client, settings):
    settings.STATSD_HOST = "localhost"
    settings.STATSD_PORT = 8125
    settings.STATSD_PREFIX = "test_prefix"

    client = get_stats_client()
    mock_statsd_client.assert_called_once_with("localhost", 8125, prefix="test_prefix")
    assert client == mock_statsd_client.return_value


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats_nothing_to_do(
    get_worker_mock, django_assert_num_queries, caplog
):
    statsd_client = MagicMock()
    get_worker_mock.return_value = statsd_client
    assert Push.objects.count() == 0
    assert Job.objects.count() == 0
    with django_assert_num_queries(2):
        publish_stats()
    assert [
        (level, message)
        for logger_name, level, message in caplog.record_tuples
        if logger_name == "treeherder.workers.stats"
    ] == [
        (20, "Publishing runtime statistics to statsd"),
        (20, "Ingested 0 pushes"),
        (20, "Ingested 0 jobs in total"),
    ]
    assert statsd_client.call_args_list == []


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats(
    get_worker_mock,
    eleven_jobs_stored_new_date,
    django_assert_num_queries,
    caplog,
    settings,
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
    assert [
        (level, message)
        for logger_name, level, message in caplog.record_tuples
        if logger_name == "treeherder.workers.stats"
    ] == [
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


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats_multiple_repos_and_states(
    get_worker_mock,
    create_push,
    test_repository,
    test_repository_2,
    generic_reference_data,
    failure_classifications,
    settings,
):
    settings.CELERY_STATS_PUBLICATION_DELAY = 10
    statsd_client = MagicMock()
    get_worker_mock.return_value = statsd_client

    _, end_date = _get_window(10)
    target_time = end_date - timedelta(minutes=1)

    push_a = create_push(test_repository, revision="rev_a1", time=target_time)
    push_b1 = create_push(test_repository_2, revision="rev_b1", time=target_time)
    push_b2 = create_push(test_repository_2, revision="rev_b2", time=target_time)

    # Repo A jobs
    _create_job("guid_a1", push_a, generic_reference_data, state="completed")
    _create_job("guid_a2", push_a, generic_reference_data, state="completed")
    _create_job("guid_a3", push_a, generic_reference_data, state="pending")

    # Repo B jobs
    _create_job("guid_b1", push_b1, generic_reference_data, state="completed")
    _create_job("guid_b2", push_b1, generic_reference_data, state="completed")
    _create_job("guid_b3", push_b2, generic_reference_data, state="completed")
    _create_job("guid_b4", push_b2, generic_reference_data, state="running")
    _create_job("guid_b5", push_b2, generic_reference_data, state="running")
    _create_job("guid_b6", push_b2, generic_reference_data, state="running")
    _create_job("guid_b7", push_b2, generic_reference_data, state="running")

    publish_stats()

    assert statsd_client.incr.call_args_list == [
        call("push", 3),
        call("jobs", 10),
        call(f"jobs_repo.{test_repository.name}", 3),
        call(f"jobs_repo.{test_repository_2.name}", 7),
        call("jobs_state.completed", 5),
        call("jobs_state.pending", 1),
        call("jobs_state.running", 4),
    ]


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats_windowing(
    get_worker_mock,
    create_push,
    test_repository,
    generic_reference_data,
    failure_classifications,
    settings,
):
    settings.CELERY_STATS_PUBLICATION_DELAY = 10
    statsd_client = MagicMock()
    get_worker_mock.return_value = statsd_client

    start_date, end_date = _get_window(10)

    before_time = start_date - timedelta(seconds=1)
    inside_time = end_date - timedelta(minutes=1)
    after_time = end_date + timedelta(seconds=1)

    push_before = create_push(test_repository, revision="rev_before", time=before_time)
    push_inside = create_push(test_repository, revision="rev_inside", time=inside_time)
    push_after = create_push(test_repository, revision="rev_after", time=after_time)

    _create_job(
        "guid_before", push_before, generic_reference_data, end_time=before_time
    )
    _create_job(
        "guid_inside", push_inside, generic_reference_data, end_time=inside_time
    )
    _create_job("guid_after", push_after, generic_reference_data, end_time=after_time)

    publish_stats()

    assert statsd_client.incr.call_args_list == [
        call("push", 1),
        call("jobs", 1),
        call(f"jobs_repo.{test_repository.name}", 1),
        call("jobs_state.completed", 1),
    ]


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats_pushes_only(
    get_worker_mock, create_push, test_repository, caplog, settings
):
    settings.CELERY_STATS_PUBLICATION_DELAY = 10
    statsd_client = MagicMock()
    get_worker_mock.return_value = statsd_client

    _, end_date = _get_window(10)
    inside_time = end_date - timedelta(minutes=1)

    create_push(test_repository, revision="rev_push_only", time=inside_time)

    publish_stats()

    assert [
        (level, message)
        for logger_name, level, message in caplog.record_tuples
        if logger_name == "treeherder.workers.stats"
    ] == [
        (20, "Publishing runtime statistics to statsd"),
        (20, "Ingested 1 pushes"),
        (20, "Ingested 0 jobs in total"),
    ]
    assert statsd_client.incr.call_args_list == [call("push", 1)]


@pytest.mark.django_db
@patch("treeherder.workers.stats.get_stats_client")
def test_publish_stats_jobs_only(
    get_worker_mock,
    create_push,
    test_repository,
    generic_reference_data,
    failure_classifications,
    caplog,
    settings,
):
    settings.CELERY_STATS_PUBLICATION_DELAY = 10
    statsd_client = MagicMock()
    get_worker_mock.return_value = statsd_client

    start_date, end_date = _get_window(10)
    before_time = start_date - timedelta(seconds=1)
    inside_time = end_date - timedelta(minutes=1)

    push_before = create_push(test_repository, revision="rev_before", time=before_time)
    _create_job(
        "guid_job_only", push_before, generic_reference_data, end_time=inside_time
    )

    publish_stats()

    assert [
        (level, message)
        for logger_name, level, message in caplog.record_tuples
        if logger_name == "treeherder.workers.stats"
    ] == [
        (20, "Publishing runtime statistics to statsd"),
        (20, "Ingested 0 pushes"),
        (20, "Ingested 1 jobs in total"),
    ]
    assert statsd_client.incr.call_args_list == [
        call("jobs", 1),
        call(f"jobs_repo.{test_repository.name}", 1),
        call("jobs_state.completed", 1),
    ]
