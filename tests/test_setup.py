import pytest
from django.conf import settings
from treeherder.model.models import Datasource
import MySQLdb
from django.core.cache import cache
from celery import current_app


@pytest.fixture
def db_conn():
    return MySQLdb.connect(
        host=settings.TREEHERDER_DATABASE_HOST,
        user=settings.TREEHERDER_DATABASE_USER,
        passwd=settings.TREEHERDER_DATABASE_PASSWORD,
    )


def test_datasource_db_created(jobs_ds, db_conn):
    cur = db_conn.cursor()
    cur.execute("SHOW DATABASES;")
    rows = cur.fetchall()
    assert jobs_ds.name in [r[0] for r in rows], \
        "When a datasource is created, a new db should be created too"
    db_conn.close()


def test_memcached_setup():
    "Test memcached is properly setup"
    k, v = 'my_key', 'my_value'
    cache.set(k, v)
    assert cache.get(k) == v


@current_app.task
def add(x, y):
    return x + y


def test_celery_setup():
    "Test celery executes a task properly"

    result = add.delay(7, 3)
    assert result.wait() == 10
