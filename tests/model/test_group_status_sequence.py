import importlib

import pytest
from django.db import connection

from treeherder.model.models import Group, GroupStatus, JobLog

migration = importlib.import_module(
    "treeherder.model.migrations.0055_restart_exhausted_group_status_id_seq"
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def job_log(test_job):
    return JobLog.objects.create(job=test_job, name="errorsummary_json", url="http://example.com")


@pytest.fixture
def group():
    return Group.objects.create(name="/dom/tests")


def _create_status(job_log, group, **kwargs):
    return GroupStatus.objects.create(
        job_log=job_log, group=group, status=GroupStatus.OK, duration=1, **kwargs
    )


def _sequence_state():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT last_value, min_value FROM pg_sequences "
            "WHERE schemaname = current_schema() AND sequencename = 'group_status_id_seq'"
        )
        return cursor.fetchone()


def _exhaust_sequence():
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT setval('group_status_id_seq', {migration.INT_MAX})")


def _restart_if_exhausted():
    with connection.cursor() as cursor:
        cursor.execute(migration.RESTART_EXHAUSTED_SEQUENCE_SQL)


def test_restarts_exhausted_sequence_when_low_ids_are_free(job_log, group):
    _create_status(job_log, group, id=migration.MIN_FREE_IDS + 1)
    _exhaust_sequence()

    _restart_if_exhausted()

    assert _create_status(job_log, group).id == 1


def test_leaves_sequence_alone_when_not_exhausted(job_log, group):
    _create_status(job_log, group, id=migration.MIN_FREE_IDS + 1)
    with connection.cursor() as cursor:
        cursor.execute("SELECT setval('group_status_id_seq', 600000000)")

    _restart_if_exhausted()

    assert _sequence_state()[0] == 600000000


def test_leaves_sequence_alone_when_low_ids_are_in_use(job_log, group):
    _create_status(job_log, group, id=10)
    _exhaust_sequence()

    _restart_if_exhausted()

    assert _sequence_state() == (migration.INT_MAX, 1)


def test_leaves_sequence_alone_when_table_is_empty():
    _exhaust_sequence()

    _restart_if_exhausted()

    assert _sequence_state()[0] == migration.INT_MAX
