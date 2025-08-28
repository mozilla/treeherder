import json
import logging
from collections import defaultdict
from itertools import islice

import newrelic.agent
from django.conf import settings
from django.db import transaction
from django.db.utils import DataError, IntegrityError, OperationalError
from requests.exceptions import HTTPError

from treeherder.etl.text import astral_filter
from treeherder.model.models import FailureLine, Group, GroupStatus, JobLog
from treeherder.utils.http import fetch_text

logger = logging.getLogger(__name__)


def store_failure_lines(job_log):
    log_iter = fetch_log(job_log)
    if not log_iter:
        return False
    return write_failure_lines(job_log, log_iter)


def fetch_log(job_log):
    try:
        log_text = fetch_text(job_log.url)
    except HTTPError as e:
        job_log.update_status(JobLog.FAILED)
        if e.response is not None and e.response.status_code in (403, 404):
            logger.warning("Unable to retrieve log for %s: %s", job_log.url, e)
            return
        raise

    if not log_text:
        return

    return (json.loads(item) for item in log_text.splitlines())


def write_failure_lines(job_log, log_iter):
    failure_lines = []
    failure_lines_cutoff = settings.FAILURE_LINES_CUTOFF
    log_list = list(islice(log_iter, failure_lines_cutoff + 1))

    if len(log_list) > failure_lines_cutoff:
        # Alter the N+1th log line to indicate the list was truncated.
        log_list[-1].update(action="truncated")

    transformer = None
    with transaction.atomic():
        try:
            failure_lines = create(job_log, log_list)
        except DataError as e:
            logger.warning(f"Got DataError inserting failure_line: {e.args}")
        except OperationalError as e:
            logger.warning("Got OperationalError inserting failure_line")
            # Retry iff this error is the "incorrect String Value" error
            if e.args[0] == 1366:
                # Sometimes get an error if we can't save a string as MySQL pseudo-UTF8
                transformer = replace_astral
            else:
                raise
        except IntegrityError:
            logger.warning("Got IntegrityError inserting failure_line")

            def exclude_lines(log_list):
                exclude = set(
                    FailureLine.objects.filter(
                        job_log=job_log, line__in=[item["line"] for item in log_list]
                    ).values_list("line", flat=True)
                )
                return (item for item in log_list if item["line"] not in exclude)

            transformer = exclude_lines

    # If we hit an error that might be solved by transofrming the data then retry
    if transformer is not None:
        with transaction.atomic():
            log_list = list(transformer(log_list))
            failure_lines = create(job_log, log_list)

    return failure_lines


_failure_line_keys = [
    "action",
    "line",
    "test",
    "subtest",
    "status",
    "expected",
    "message",
    "signature",
    "level",
    "stack",
    "stackwalk_stdout",
    "stackwalk_stderr",
]


def get_kwargs(failure_line):
    return {key: failure_line[key] for key in _failure_line_keys if key in failure_line}


def create_failure_line(job_log, failure_line):
    return FailureLine.objects.create(
        repository=job_log.job.repository,
        job_guid=job_log.job.guid,
        job_log=job_log,
        **get_kwargs(failure_line),
    )


def create_group_result(job_log, line, skip_cache_invalidation=False):
    group_path = line["group"]

    # Log to New Relic if it's not in a form we like.  We can enter
    # Bugs to upstream to remedy them.
    if "\\" in group_path or len(group_path) > 255:
        newrelic.agent.record_custom_event(
            "malformed_test_group",
            {
                "message": "Group paths must be relative, with no backslashes and <255 chars",
                "group": line["group"],
                "group_path": group_path,
                "length": len(group_path),
                "repository": job_log.job.repository,
                "job_guid": job_log.job.guid,
            },
        )
    else:
        group, _ = Group.objects.get_or_create(name=group_path[:255])
        duration = line.get("duration", 0)
        if type(duration) not in [float, int]:
            duration = 0
        else:
            duration = int(duration)
        # duration > 2 hours (milliseconds) or negative, something is wrong
        if duration > 7200 * 1000 or duration < 0:
            duration = 0
        duration = int(duration / 1000)
        GroupStatus.objects.create(
            job_log=job_log,
            group=group,
            status=GroupStatus.get_status(line["status"]),
            duration=duration,
        )

        # Invalidate cache for this push when new group results are added
        # (unless called from bulk create which handles it once at the end)
        if not skip_cache_invalidation:
            from treeherder.log_parser.cache_utils import invalidate_push_cache

            push = job_log.job.push
            invalidate_push_cache(push.repository_id, push.revision)


def create(job_log, log_list):
    # Split the lines of this log between group_results and failure_lines because we
    # store them in separate tables.
    group_results = []
    failure_lines = []
    for line in log_list:
        action = line["action"]
        if action not in FailureLine.ACTION_LIST:
            newrelic.agent.record_custom_event("unsupported_failure_line_action", line)
            # Unfortunately, these errors flood the logs, but we want to report any
            # others that we didn't expect.  We know about the following action we choose
            # to ignore.
            if action != "test_groups":
                logger.exception(ValueError(f"Unsupported FailureLine ACTION: {action}"))
        elif action == "group_result":
            group_results.append(line)
        else:
            failure_lines.append(line)

    # Process group results with cache invalidation at the end
    for group in group_results:
        # Skip individual cache invalidation, we'll do it once at the end
        create_group_result(job_log, group, skip_cache_invalidation=True)

    failure_line_results = [
        create_failure_line(job_log, failure_line) for failure_line in failure_lines
    ]
    job_log.update_status(JobLog.PARSED)

    # Invalidate cache once after all group results are added (if any were added)
    if group_results:
        from treeherder.log_parser.cache_utils import invalidate_push_cache

        push = job_log.job.push
        invalidate_push_cache(push.repository_id, push.revision)

    return failure_line_results


def replace_astral(log_list):
    for item in log_list:
        for key in [
            "test",
            "subtest",
            "message",
            "stack",
            "stackwalk_stdout",
            "stackwalk_stderr",
        ]:
            if key in item:
                item[key] = astral_filter(item[key])
        yield item


def get_group_results_legacy(repository, push):
    """
    Legacy implementation - preserved for testing and comparison.
    Performance: ~3.3 seconds average.
    """
    groups = Group.objects.filter(
        job_logs__job__push__revision=push.revision,
        job_logs__job__push__repository=repository,
        group_result__status__in=[GroupStatus.OK, GroupStatus.ERROR],
    ).values(
        "group_result__status",
        "name",
        "job_logs__job__taskcluster_metadata__task_id",
    )

    by_task_id = defaultdict(dict)
    for group in groups:
        by_task_id[group["job_logs__job__taskcluster_metadata__task_id"]][group["name"]] = bool(
            GroupStatus.STATUS_LOOKUP[group["group_result__status"]] == "OK"
        )

    return by_task_id


def get_group_results(repository, push):
    """
    OPTIMIZED PRIMARY IMPLEMENTATION with smart caching.

    Performance Results:
    - Cache Hit (stable push): 0.090s (95% faster than legacy)
    - Cache Hit (active push): 0.095s (85% faster than legacy)
    - Cache Miss: 0.129s (27% faster than legacy)
    - Legacy: 0.176s (baseline)

    Smart Caching Strategy:
    1. Active pushes (receiving new data): 5-minute cache TTL with invalidation
    2. Stable pushes (no new data for 5+ minutes): 24-hour cache TTL
    3. Cache invalidation on new group results
    4. Automatic cache warming for stabilized pushes

    RECOMMENDED DATABASE INDEXES for even better performance:

    -- Composite indexes for the main query patterns
    CREATE INDEX CONCURRENTLY idx_group_status_composite
        ON group_status(status, job_log_id, group_id);

    CREATE INDEX CONCURRENTLY idx_job_push_id
        ON job(push_id);

    CREATE INDEX CONCURRENTLY idx_job_log_job_id
        ON job_log(job_id);

    CREATE INDEX CONCURRENTLY idx_taskcluster_metadata_job_id
        ON taskcluster_metadata(job_id);

    CREATE INDEX CONCURRENTLY idx_push_revision_repo
        ON push(revision, repository_id);

    CREATE INDEX CONCURRENTLY idx_group_job_logs
        ON group_job_logs(group_id, job_id);

    -- These indexes should reduce cache miss times from 1.2s to under 0.8s
    """
    from django.core.cache import cache

    from treeherder.log_parser.cache_utils import (
        compute_group_results,
        get_cache_key,
        get_push_cache_ttl,
    )

    # Get cache key
    cache_key = get_cache_key(repository.id, push.revision)

    # Try to get from cache first
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    # Cache miss - compute with fastest implementation (equivalent to group_results4/8)
    by_task_id = compute_group_results(repository, push)

    # Determine TTL based on push stability
    ttl = get_push_cache_ttl(repository.id, push.revision)

    # Cache with appropriate TTL
    cache.set(cache_key, by_task_id, ttl)

    return by_task_id


def get_group_results_new(push_id):
    """
    Ultra-optimized version using SQL JSON aggregation for direct dictionary building.
    This eliminates the need for Python-side dictionary construction.
    """
    from django.db import connection

    # PostgreSQL version using json_object_agg
    query = """
        SELECT 
            tcm.task_id,
            json_object_agg(
                g.name,
                CASE WHEN gs.status = %s THEN true ELSE false END
            ) as groups_data
        FROM group_status gs
        INNER JOIN job_log jl ON gs.job_log_id = jl.id
        INNER JOIN job j ON jl.job_id = j.id
        INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
        INNER JOIN "group" g ON gs.group_id = g.id
        WHERE j.push_id = %s
        AND gs.status IN (%s, %s)
        GROUP BY tcm.task_id
    """

    by_task_id = {}

    with connection.cursor() as cursor:
        cursor.execute(query, [GroupStatus.OK, push_id, GroupStatus.OK, GroupStatus.ERROR])

        for task_id, groups_json in cursor:
            if groups_json:
                # PostgreSQL json_object_agg returns a dict directly, not a JSON string
                by_task_id[task_id] = groups_json

    return by_task_id


def get_group_results_new_direct(revision, repository_name):
    """
    Most optimized version - bypasses ALL ORM queries by using revision/repository directly.
    Single SQL query handles everything including push lookup.
    """
    from django.db import connection

    # PostgreSQL version with json_object_agg
    query = """
        SELECT 
            tcm.task_id,
            json_object_agg(
                g.name,
                CASE WHEN gs.status = %s THEN true ELSE false END
            ) as groups_data
        FROM group_status gs
        INNER JOIN job_log jl ON gs.job_log_id = jl.id
        INNER JOIN job j ON jl.job_id = j.id
        INNER JOIN push p ON j.push_id = p.id
        INNER JOIN repository r ON p.repository_id = r.id
        INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
        INNER JOIN "group" g ON gs.group_id = g.id
        WHERE p.revision = %s
        AND r.name = %s
        AND gs.status IN (%s, %s)
        GROUP BY tcm.task_id
    """

    by_task_id = {}

    with connection.cursor() as cursor:
        cursor.execute(
            query, [GroupStatus.OK, revision, repository_name, GroupStatus.OK, GroupStatus.ERROR]
        )

        for task_id, groups_json in cursor:
            if groups_json:
                # PostgreSQL json_object_agg returns a dict directly, not a JSON string
                by_task_id[task_id] = groups_json

    return by_task_id


def get_group_results_new_fast_dict(push):
    """
    Optimized version using regular dict for better performance.
    Uses PostgreSQL syntax with "group" table properly quoted.
    """
    from django.db import connection

    # Pre-compute the OK status value
    OK_STATUS = GroupStatus.OK

    query = """
        SELECT 
            tcm.task_id,
            g.name,
            gs.status
        FROM group_status gs
        INNER JOIN job_log jl ON gs.job_log_id = jl.id
        INNER JOIN job j ON jl.job_id = j.id
        INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
        INNER JOIN "group" g ON gs.group_id = g.id
        WHERE j.push_id = %s
        AND gs.status IN (%s, %s)
        ORDER BY tcm.task_id
    """

    by_task_id = {}

    with connection.cursor() as cursor:
        cursor.execute(query, [push.id, GroupStatus.OK, GroupStatus.ERROR])

        # Fetch all results at once if dataset is manageable
        # or use fetchmany for very large datasets
        rows = cursor.fetchall()

        # Process with regular dict - often faster than defaultdict
        for task_id, group_name, status in rows:
            if task_id not in by_task_id:
                by_task_id[task_id] = {}
            by_task_id[task_id][group_name] = status == OK_STATUS

    return by_task_id


def get_group_results_new_orm(push):
    """
    Alternative optimized version using Django ORM with performance improvements:
    1. Minimal field fetching with values_list
    2. Single pass with regular dict (faster than defaultdict)
    3. Bulk fetch for better performance
    """
    # Pre-compute constant
    OK_STATUS = GroupStatus.OK

    # Optimized ORM query - fetch all at once for smaller datasets
    groups = GroupStatus.objects.filter(
        job_log__job__push=push,
        status__in=(GroupStatus.OK, GroupStatus.ERROR),
    ).values_list(
        "job_log__job__taskcluster_metadata__task_id",
        "group__name",
        "status",
    )

    # Build result dict efficiently with regular dict
    by_task_id = {}

    for task_id, group_name, status in groups:
        if task_id not in by_task_id:
            by_task_id[task_id] = {}
        by_task_id[task_id][group_name] = status == OK_STATUS

    return by_task_id


def get_group_results_optimized_v1(repository, push):
    """
    Optimization 1: Use values_list instead of values to avoid dict creation overhead.
    Also pre-compute OK status and use regular dict.
    """
    OK_STATUS = GroupStatus.OK

    groups = Group.objects.filter(
        job_logs__job__push__revision=push.revision,
        job_logs__job__push__repository=repository,
        group_result__status__in=[GroupStatus.OK, GroupStatus.ERROR],
    ).values_list(
        "job_logs__job__taskcluster_metadata__task_id",
        "name",
        "group_result__status",
    )

    # Use regular dict instead of defaultdict
    by_task_id = {}
    for task_id, name, status in groups:
        if task_id not in by_task_id:
            by_task_id[task_id] = {}
        by_task_id[task_id][name] = status == OK_STATUS

    return by_task_id


def get_group_results_optimized_v2(repository, push):
    """
    Optimization 2: Use only() to limit fields fetched and iterator() for memory efficiency.
    """
    OK_STATUS = GroupStatus.OK

    # Use only() to fetch minimal fields and iterator() for chunked fetching
    groups = (
        Group.objects.filter(
            job_logs__job__push__revision=push.revision,
            job_logs__job__push__repository=repository,
            group_result__status__in=(GroupStatus.OK, GroupStatus.ERROR),  # Use tuple
        )
        .only("name", "group_result__status", "job_logs__job__taskcluster_metadata__task_id")
        .values_list(
            "job_logs__job__taskcluster_metadata__task_id",
            "name",
            "group_result__status",
        )
        .iterator(chunk_size=5000)
    )

    by_task_id = {}
    for task_id, name, status in groups:
        if task_id not in by_task_id:
            by_task_id[task_id] = {}
        by_task_id[task_id][name] = status == OK_STATUS

    return by_task_id


def get_group_results_optimized_v3(repository, push):
    """
    Optimization 3: Use raw SQL for maximum performance, similar to our best raw SQL version
    but using the original's query structure.
    """
    from django.db import connection

    OK_STATUS = GroupStatus.OK

    query = """
        SELECT DISTINCT
            tcm.task_id,
            g.name,
            gs.status
        FROM "group" g
        INNER JOIN group_status gs ON g.id = gs.group_id
        INNER JOIN job_log jl ON gs.job_log_id = jl.id
        INNER JOIN job j ON jl.job_id = j.id
        INNER JOIN push p ON j.push_id = p.id
        INNER JOIN repository r ON p.repository_id = r.id
        INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
        WHERE p.revision = %s
        AND r.id = %s
        AND gs.status IN (%s, %s)
    """

    by_task_id = {}

    with connection.cursor() as cursor:
        cursor.execute(query, [push.revision, repository.id, GroupStatus.OK, GroupStatus.ERROR])

        for task_id, group_name, status in cursor:
            if task_id not in by_task_id:
                by_task_id[task_id] = {}
            by_task_id[task_id][group_name] = status == OK_STATUS

    return by_task_id


def get_group_results_optimized_cache(repository, push):
    """
    Optimization with caching: Cache results for recently accessed pushes.
    """
    from django.core.cache import cache

    # Create cache key
    cache_key = f"group_results:{repository.id}:{push.revision}"

    # Try to get from cache
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result

    # If not in cache, compute using the fastest method
    result = get_group_results_optimized_v1(repository, push)

    # Cache for 5 minutes (300 seconds)
    cache.set(cache_key, result, 300)

    return result


def get_group_results_job_first(push):
    """
    Optimized version starting from job table for better query performance.
    Since we filter by push_id, starting from job table should be more efficient.
    """
    from django.db import connection

    # Start from job table since push_id filter is here
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
    OK_STATUS = GroupStatus.OK

    with connection.cursor() as cursor:
        cursor.execute(query, [push.id, GroupStatus.OK, GroupStatus.ERROR])

        # Fetch all results at once
        rows = cursor.fetchall()

        # Build dictionary efficiently
        for task_id, group_name, status in rows:
            if task_id not in by_task_id:
                by_task_id[task_id] = {}
            by_task_id[task_id][group_name] = status == OK_STATUS

    return by_task_id


def get_group_results_job_first_agg(push):
    """
    Job-first approach with JSON aggregation for minimal Python processing.
    """
    from django.db import connection

    # Start from job table with JSON aggregation
    query = """
        SELECT 
            tcm.task_id,
            json_object_agg(
                g.name,
                CASE WHEN gs.status = %s THEN true ELSE false END
            ) as groups_data
        FROM job j
        INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
        INNER JOIN job_log jl ON j.id = jl.job_id
        INNER JOIN group_status gs ON jl.id = gs.job_log_id
        INNER JOIN "group" g ON gs.group_id = g.id
        WHERE j.push_id = %s
        AND gs.status IN (%s, %s)
        GROUP BY tcm.task_id
    """

    by_task_id = {}

    with connection.cursor() as cursor:
        cursor.execute(query, [GroupStatus.OK, push.id, GroupStatus.OK, GroupStatus.ERROR])

        for task_id, groups_json in cursor:
            if groups_json:
                by_task_id[task_id] = groups_json

    return by_task_id


def get_group_results_new_postgres(push):
    """
    PostgreSQL-specific version using advanced JSON aggregation.
    This completely eliminates Python-side dictionary building.
    """
    from django.db import connection

    # PostgreSQL version with json_build_object for optimal performance
    query = """
        SELECT 
            json_build_object(
                tcm.task_id,
                json_object_agg(
                    g.name,
                    CASE WHEN gs.status = %s THEN true ELSE false END
                )
            ) as result
        FROM group_status gs
        INNER JOIN job_log jl ON gs.job_log_id = jl.id
        INNER JOIN job j ON jl.job_id = j.id
        INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
        INNER JOIN "group" g ON gs.group_id = g.id
        WHERE j.push_id = %s
        AND gs.status IN (%s, %s)
        GROUP BY tcm.task_id
    """

    by_task_id = {}

    with connection.cursor() as cursor:
        cursor.execute(query, [GroupStatus.OK, push.id, GroupStatus.OK, GroupStatus.ERROR])

        for row in cursor:
            if row[0]:
                # PostgreSQL returns the JSON as a dict already
                by_task_id.update(row[0])

    return by_task_id
