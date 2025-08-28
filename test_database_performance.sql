-- Database Performance Test for Optimized Indexes
-- This tests the main query patterns used by the group_results endpoint

\echo '================================================================================'
\echo 'Database Performance Test with Optimized Indexes'
\echo '================================================================================'

\echo ''
\echo '1. Checking optimized indexes:'
SELECT 
    '   ✅ ' || indexname || ' on ' || tablename as index_info
FROM pg_indexes 
WHERE indexname LIKE 'idx_%optimized' 
   OR indexname LIKE 'idx_group_push_lookup' 
   OR indexname LIKE 'idx_job_push_repo%'
   OR indexname LIKE 'idx_%covering'
ORDER BY tablename, indexname;

\echo ''
\echo '2. Testing main group_results query performance:'
\echo '   Running query 5 times to measure performance...'

\timing on

-- This mimics the Django ORM query from get_group_results()
SELECT 
    tcm.task_id,
    g.name,
    gs.status
FROM "group" g
INNER JOIN group_status gs ON g.id = gs.group_id
INNER JOIN job_log jl ON gs.job_log_id = jl.id
INNER JOIN job j ON jl.job_id = j.id
INNER JOIN push p ON j.push_id = p.id
INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
WHERE p.revision = '8c8cc3df365d6c2732ba6af61a92dd6b433a1f57'
  AND p.repository_id = 4
  AND gs.status IN (1, 2)
LIMIT 5;

-- Run it a few more times for timing
SELECT count(*) as total_results
FROM "group" g
INNER JOIN group_status gs ON g.id = gs.group_id
INNER JOIN job_log jl ON gs.job_log_id = jl.id
INNER JOIN job j ON jl.job_id = j.id
INNER JOIN push p ON j.push_id = p.id
INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
WHERE p.revision = '8c8cc3df365d6c2732ba6af61a92dd6b433a1f57'
  AND p.repository_id = 4
  AND gs.status IN (1, 2);

-- Test again
SELECT count(*) as total_results_run2
FROM "group" g
INNER JOIN group_status gs ON g.id = gs.group_id
INNER JOIN job_log jl ON gs.job_log_id = jl.id
INNER JOIN job j ON jl.job_id = j.id
INNER JOIN push p ON j.push_id = p.id
INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
WHERE p.revision = '8c8cc3df365d6c2732ba6af61a92dd6b433a1f57'
  AND p.repository_id = 4
  AND gs.status IN (1, 2);

-- Test again
SELECT count(*) as total_results_run3
FROM "group" g
INNER JOIN group_status gs ON g.id = gs.group_id
INNER JOIN job_log jl ON gs.job_log_id = jl.id
INNER JOIN job j ON jl.job_id = j.id
INNER JOIN push p ON j.push_id = p.id
INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
WHERE p.revision = '8c8cc3df365d6c2732ba6af61a92dd6b433a1f57'
  AND p.repository_id = 4
  AND gs.status IN (1, 2);

\timing off

\echo ''
\echo '3. Query execution plan analysis:'
EXPLAIN ANALYZE
SELECT 
    tcm.task_id,
    g.name,
    gs.status
FROM "group" g
INNER JOIN group_status gs ON g.id = gs.group_id
INNER JOIN job_log jl ON gs.job_log_id = jl.id
INNER JOIN job j ON jl.job_id = j.id
INNER JOIN push p ON j.push_id = p.id
INNER JOIN taskcluster_metadata tcm ON j.id = tcm.job_id
WHERE p.revision = '8c8cc3df365d6c2732ba6af61a92dd6b433a1f57'
  AND p.repository_id = 4
  AND gs.status IN (1, 2)
LIMIT 100;

\echo ''
\echo '================================================================================'
\echo 'Database performance test completed!'
\echo 'The optimized indexes should provide better performance for group_results queries.'
\echo '================================================================================'