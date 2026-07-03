import pytest

from tests.conftest import REDIS_DB_COUNT, redis_url_for_worker


@pytest.mark.parametrize(
    ("base_url", "worker_id", "expected"),
    [
        # Each worker maps to its own Redis logical database.
        ("redis://redis:6379", "gw0", "redis://redis:6379/0"),
        ("redis://redis:6379", "gw3", "redis://redis:6379/3"),
        # Worker indexes above the number of Redis DBs wrap around.
        ("redis://redis:6379", "gw17", f"redis://redis:6379/{17 % REDIS_DB_COUNT}"),
        # An existing database path is replaced rather than appended.
        ("redis://redis:6379/0", "gw2", "redis://redis:6379/2"),
        # The TLS scheme is preserved.
        ("rediss://redis:6379", "gw1", "rediss://redis:6379/1"),
    ],
)
def test_redis_url_for_worker_assigns_per_worker_db(base_url, worker_id, expected):
    assert redis_url_for_worker(base_url, worker_id) == expected


@pytest.mark.parametrize(
    ("base_url", "worker_id"),
    [
        # No xdist worker (running with -n0) leaves the URL untouched.
        ("redis://redis:6379", ""),
        ("redis://redis:6379", None),
        # Non-Redis cache locations (e.g. the database cache) are left alone.
        ("new_failure_cache", "gw0"),
        (None, "gw0"),
    ],
)
def test_redis_url_for_worker_leaves_non_redis_unchanged(base_url, worker_id):
    assert redis_url_for_worker(base_url, worker_id) == base_url
