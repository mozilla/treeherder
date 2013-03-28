import pytest
from django.conf import settings
from treeherder.webapp.models import Datasource
import MySQLdb
from django.core.cache import cache


@pytest.fixture
def jobs_ds():
    prefix = getattr(settings, "TEST_DB_PREFIX", "")
    return Datasource.objects.create(
        project="{0}test_myproject".format(prefix),
        dataset=1,
        contenttype="jobs",
        host="localhost",
    )


@pytest.fixture
def objectstore_ds():
    prefix = getattr(settings, "TEST_DB_PREFIX", "")
    return Datasource.objects.create(
        project="{0}test_myproject".format(prefix),
        dataset=1,
        contenttype="objectstore",
        host="localhost",
    )


@pytest.fixture
def db_conn():
    return MySQLdb.connect(
        host="localhost",
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
