"""
Tests for cache management utilities in log_parser.
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from treeherder.log_parser.cache_utils import (
    ACTIVE_PUSH_TTL,
    STABILITY_THRESHOLD,
    STABLE_PUSH_TTL,
    check_push_stability,
    compute_group_results,
    get_activity_key,
    get_cache_key,
    get_push_cache_ttl,
    get_stable_key,
    invalidate_push_cache,
    warm_cache_for_push,
)
from treeherder.model.models import GroupStatus


class TestCacheKeys:
    """Test cache key generation functions."""

    def test_get_cache_key(self):
        key = get_cache_key(1, "abc123")
        assert key == "group_results_v3:1:abc123"

    def test_get_activity_key(self):
        key = get_activity_key(1, "abc123")
        assert key == "push_activity:1:abc123"

    def test_get_stable_key(self):
        key = get_stable_key(1, "abc123")
        assert key == "push_stable:1:abc123"


class TestCacheInvalidation:
    """Test cache invalidation functionality."""

    @pytest.fixture(autouse=True)
    def setup(self):
        cache.clear()

    @patch("treeherder.log_parser.cache_utils.warm_cache_for_push.apply_async")
    def test_invalidate_push_cache(self, mock_apply_async):
        repository_id = 1
        revision = "test_revision"

        # Set some initial cache values
        cache_key = get_cache_key(repository_id, revision)
        stable_key = get_stable_key(repository_id, revision)
        cache.set(cache_key, {"task1": {"group1": True}})
        cache.set(stable_key, True)

        # Invalidate cache
        invalidate_push_cache(repository_id, revision)

        # Check main cache was deleted
        assert cache.get(cache_key) is None

        # Check stable status was removed
        assert cache.get(stable_key) is None

        # Check activity was updated
        activity_key = get_activity_key(repository_id, revision)
        activity = cache.get(activity_key)
        assert activity is not None

        # Verify it's a recent timestamp
        activity_time = datetime.fromisoformat(activity)
        assert (datetime.now() - activity_time).total_seconds() < 1

        # Check warm cache task was scheduled
        mock_apply_async.assert_called_once_with(
            args=[repository_id, revision], countdown=STABILITY_THRESHOLD
        )


class TestPushStability:
    """Test push stability checking."""

    @pytest.fixture(autouse=True)
    def setup(self):
        cache.clear()

    def test_check_push_stability_no_activity(self):
        # No activity tracked - should be considered stable
        assert check_push_stability(1, "rev1") is True

    def test_check_push_stability_recent_activity(self):
        repository_id = 1
        revision = "rev1"
        activity_key = get_activity_key(repository_id, revision)

        # Set recent activity
        cache.set(activity_key, datetime.now().isoformat())

        # Should not be stable
        assert check_push_stability(repository_id, revision) is False

    def test_check_push_stability_old_activity(self):
        repository_id = 1
        revision = "rev1"
        activity_key = get_activity_key(repository_id, revision)

        # Set old activity (10 minutes ago)
        old_time = datetime.now() - timedelta(minutes=10)
        cache.set(activity_key, old_time.isoformat())

        # Should be stable
        assert check_push_stability(repository_id, revision) is True

    def test_check_push_stability_invalid_timestamp(self):
        repository_id = 1
        revision = "rev1"
        activity_key = get_activity_key(repository_id, revision)

        # Set invalid timestamp
        cache.set(activity_key, "invalid")

        # Should default to stable
        assert check_push_stability(repository_id, revision) is True


class TestCacheTTL:
    """Test cache TTL determination."""

    @pytest.fixture(autouse=True)
    def setup(self):
        cache.clear()

    def test_get_push_cache_ttl_already_stable(self):
        repository_id = 1
        revision = "rev1"
        stable_key = get_stable_key(repository_id, revision)

        # Mark as stable
        cache.set(stable_key, True)

        # Should get stable TTL
        ttl = get_push_cache_ttl(repository_id, revision)
        assert ttl == STABLE_PUSH_TTL

    def test_get_push_cache_ttl_becomes_stable(self):
        repository_id = 1
        revision = "rev1"
        activity_key = get_activity_key(repository_id, revision)

        # Set old activity
        old_time = datetime.now() - timedelta(minutes=10)
        cache.set(activity_key, old_time.isoformat())

        # Should get stable TTL and be marked stable
        ttl = get_push_cache_ttl(repository_id, revision)
        assert ttl == STABLE_PUSH_TTL

        # Check it was marked stable
        stable_key = get_stable_key(repository_id, revision)
        assert cache.get(stable_key) is True

    def test_get_push_cache_ttl_active(self):
        repository_id = 1
        revision = "rev1"
        activity_key = get_activity_key(repository_id, revision)

        # Set recent activity
        cache.set(activity_key, datetime.now().isoformat())

        # Should get active TTL
        ttl = get_push_cache_ttl(repository_id, revision)
        assert ttl == ACTIVE_PUSH_TTL


class TestCacheWarming:
    """Test cache warming functionality."""

    @pytest.fixture(autouse=True)
    def setup(self):
        cache.clear()

    @patch("treeherder.log_parser.cache_utils.compute_group_results")
    @patch("treeherder.log_parser.cache_utils.Push")
    @patch("treeherder.log_parser.cache_utils.Repository")
    def test_warm_cache_for_stable_push(self, mock_repo_class, mock_push_class, mock_compute):
        repository_id = 1
        revision = "rev1"

        # Setup mocks
        mock_repo = MagicMock()
        mock_push = MagicMock()
        mock_repo_class.objects.get.return_value = mock_repo
        mock_push_class.objects.get.return_value = mock_push
        mock_compute.return_value = {"task1": {"group1": True}}

        # Set old activity (stable push)
        activity_key = get_activity_key(repository_id, revision)
        old_time = datetime.now() - timedelta(minutes=10)
        cache.set(activity_key, old_time.isoformat())

        # Warm cache
        warm_cache_for_push(repository_id, revision)

        # Check compute was called
        mock_compute.assert_called_once_with(mock_repo, mock_push)

        # Check cache was set with stable TTL
        cache_key = get_cache_key(repository_id, revision)
        cached = cache.get(cache_key)
        assert cached == {"task1": {"group1": True}}

        # Check marked as stable
        stable_key = get_stable_key(repository_id, revision)
        assert cache.get(stable_key) is True

    @patch("treeherder.log_parser.cache_utils.compute_group_results")
    def test_warm_cache_skip_active_push(self, mock_compute):
        repository_id = 1
        revision = "rev1"

        # Set recent activity (active push)
        activity_key = get_activity_key(repository_id, revision)
        cache.set(activity_key, datetime.now().isoformat())

        # Warm cache
        warm_cache_for_push(repository_id, revision)

        # Compute should not be called for active push
        mock_compute.assert_not_called()


class TestComputeGroupResults:
    """Test the compute_group_results function."""

    @patch("treeherder.log_parser.cache_utils.connection")
    def test_compute_group_results(self, mock_connection):
        # Setup mock cursor and results
        mock_cursor = MagicMock()
        mock_connection.cursor.return_value.__enter__.return_value = mock_cursor

        # Mock query results
        mock_cursor.fetchall.return_value = [
            ("task1", "group1", GroupStatus.OK),
            ("task1", "group2", GroupStatus.ERROR),
            ("task2", "group1", GroupStatus.OK),
        ]

        # Create mock repository and push
        mock_repo = MagicMock()
        mock_push = MagicMock()
        mock_push.id = 123

        # Compute results
        result = compute_group_results(mock_repo, mock_push)

        # Verify results
        assert result == {
            "task1": {
                "group1": True,
                "group2": False,
            },
            "task2": {
                "group1": True,
            },
        }

        # Verify query was executed with correct parameters
        mock_cursor.execute.assert_called_once()
        args = mock_cursor.execute.call_args[0]
        assert mock_push.id in args[1]
        assert GroupStatus.OK in args[1]
        assert GroupStatus.ERROR in args[1]
