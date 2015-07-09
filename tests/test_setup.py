# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from django.conf import settings
import MySQLdb
from django.core.cache import cache
from celery import current_app


@pytest.fixture
def db_conn():
    db_options = settings.DATABASES['default'].get('OPTIONS', {})
    return MySQLdb.connect(
        host=settings.DATABASES['default']['HOST'],
        user=settings.DATABASES['default']['USER'],
        passwd=settings.DATABASES['default']['PASSWORD'],
        **db_options
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
