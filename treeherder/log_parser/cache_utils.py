"""
Cache management utilities for group results with smart invalidation and warming.
"""

import logging
from datetime import datetime

from celery import shared_task
from django.core.cache import cache

from treeherder.model.models import GroupStatus, Push, Repository

logger = logging.getLogger(__name__)

# Cache key prefixes
CACHE_KEY_PREFIX = "group_results_v3"
ACTIVITY_KEY_PREFIX = "push_activity"
STABLE_KEY_PREFIX = "push_stable"

# Cache TTL settings
ACTIVE_PUSH_TTL = 300  # 5 minutes for active pushes
STABLE_PUSH_TTL = 86400  # 24 hours for stable pushes
STABILITY_THRESHOLD = 300  # 5 minutes of inactivity to consider stable


def get_cache_key(repository_id, revision):
    """Generate cache key for group results."""
    return f"{CACHE_KEY_PREFIX}:{repository_id}:{revision}"


def get_activity_key(repository_id, revision):
    """Generate cache key for tracking push activity."""
    return f"{ACTIVITY_KEY_PREFIX}:{repository_id}:{revision}"


def get_stable_key(repository_id, revision):
    """Generate cache key for push stability status."""
    return f"{STABLE_KEY_PREFIX}:{repository_id}:{revision}"


def invalidate_push_cache(repository_id, revision):
    """
    Invalidate cache for a push and update activity tracking.

    Called when new group results are added to a push.
    """
    # Invalidate the main cache
    cache_key = get_cache_key(repository_id, revision)
    cache.delete(cache_key)

    # Update last activity timestamp
    activity_key = get_activity_key(repository_id, revision)
    cache.set(activity_key, datetime.now().isoformat(), timeout=None)

    # Remove stable status since push is now active
    stable_key = get_stable_key(repository_id, revision)
    cache.delete(stable_key)

    # Schedule cache warming check
    warm_cache_for_push.apply_async(args=[repository_id, revision], countdown=STABILITY_THRESHOLD)

    logger.debug(f"Cache invalidated for push {revision} in repository {repository_id}")


def check_push_stability(repository_id, revision):
    """
    Check if a push has been stable (no new activity) for the threshold period.

    Returns True if stable, False otherwise.
    """
    activity_key = get_activity_key(repository_id, revision)
    last_activity_str = cache.get(activity_key)

    if not last_activity_str:
        # No activity tracked, consider it stable
        return True

    try:
        last_activity = datetime.fromisoformat(last_activity_str)
        time_since_activity = datetime.now() - last_activity
        return time_since_activity.total_seconds() >= STABILITY_THRESHOLD
    except (ValueError, TypeError):
        logger.warning(f"Invalid activity timestamp for push {revision}")
        return True


def get_push_cache_ttl(repository_id, revision):
    """
    Determine appropriate cache TTL based on push stability.

    Returns TTL in seconds.
    """
    stable_key = get_stable_key(repository_id, revision)

    # Check if already marked as stable
    if cache.get(stable_key):
        return STABLE_PUSH_TTL

    # Check if push has been inactive long enough
    if check_push_stability(repository_id, revision):
        # Mark as stable
        cache.set(stable_key, True, timeout=STABLE_PUSH_TTL)
        return STABLE_PUSH_TTL

    return ACTIVE_PUSH_TTL


@shared_task(bind=True, max_retries=3)
def warm_cache_for_push(self, repository_id, revision):
    """
    Celery task to warm cache for a push if it has stabilized.

    This task is scheduled after cache invalidation to check if the push
    has become stable (no new activity for STABILITY_THRESHOLD seconds).
    """
    try:
        # Check if push has stabilized
        if not check_push_stability(repository_id, revision):
            logger.debug(f"Push {revision} still active, skipping cache warming")
            return

        # Get repository and push objects
        try:
            repository = Repository.objects.get(id=repository_id)
            push = Push.objects.get(repository=repository, revision=revision)
        except (Repository.DoesNotExist, Push.DoesNotExist):
            logger.warning(f"Repository {repository_id} or push {revision} not found")
            return

        # Import here to avoid circular dependency
        from treeherder.log_parser.failureline import compute_group_results

        # Compute group results
        by_task_id = compute_group_results(repository, push)

        # Cache with stable TTL
        cache_key = get_cache_key(repository_id, revision)
        cache.set(cache_key, by_task_id, timeout=STABLE_PUSH_TTL)

        # Mark as stable
        stable_key = get_stable_key(repository_id, revision)
        cache.set(stable_key, True, timeout=STABLE_PUSH_TTL)

        logger.info(f"Cache warmed for stable push {revision} in repository {repository_id}")

    except Exception as e:
        logger.error(f"Error warming cache for push {revision}: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))


def compute_group_results(repository, push):
    """
    Compute group results without caching.

    This is the core computation logic extracted for reuse.
    Uses the fastest non-cached implementation (equivalent to group_results4/8).
    """
    from django.db import connection

    OK_STATUS = GroupStatus.OK

    query = """
        SELECT 
            tcm.task_id,
            g.name,
            gs.status
        FROM job j
        INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
        INNER JOIN job_log jl ON j.id = jl.job_id
        INNER JOIN group_status gs ON jl.id = gs.job_log_id
        INNER JOIN "group" g ON gs.group_id = g.id
        WHERE j.push_id = %s
        AND gs.status IN (%s, %s)
        ORDER BY tcm.task_id
    """

    by_task_id = {}

    with connection.cursor() as cursor:
        cursor.execute(query, [push.id, GroupStatus.OK, GroupStatus.ERROR])
        rows = cursor.fetchall()

        for task_id, group_name, status in rows:
            if task_id not in by_task_id:
                by_task_id[task_id] = {}
            by_task_id[task_id][group_name] = status == OK_STATUS

    return by_task_id
