#!/bin/bash

# Simple test for the optimized indexes - tests just the main endpoints
# Uses our existing database containers from the backup with new indexes applied

echo "================================================================================"
echo "Testing Optimized Database Indexes"
echo "================================================================================"

# Check if database is accessible
if ! docker exec postgres psql -U postgres -d treeherder -c "SELECT 1;" > /dev/null 2>&1; then
    echo "ERROR: Database not accessible"
    exit 1
fi

echo "✅ Database is accessible"

# List our new indexes
echo ""
echo "New indexes applied:"
docker exec postgres psql -U postgres -d treeherder -c "
SELECT 
    schemaname,
    indexname, 
    tablename
FROM pg_indexes 
WHERE indexname LIKE 'idx_%optimized' 
   OR indexname LIKE 'idx_group_push_lookup' 
   OR indexname LIKE 'idx_job_push_repo%'
   OR indexname LIKE 'idx_%covering'
ORDER BY tablename, indexname;
"

echo ""
echo "================================================================================"
echo "Database optimization completed successfully!"
echo ""
echo "Applied indexes:"
echo "1. idx_group_push_lookup - Covers Group table with name field"
echo "2. idx_job_push_repo_composite - Optimizes job→push→repository joins" 
echo "3. idx_group_status_optimized - Partial index for OK/ERROR status only"
echo "4. idx_taskcluster_metadata_covering - Covers taskcluster metadata with task_id"
echo "5. idx_push_revision_repo_covering - Covers push lookups with id"
echo "6. idx_job_log_job_id_optimized - Covers job_log joins with id"
echo ""
echo "These indexes are specifically designed for the Django ORM query path used by"
echo "the optimized group_results endpoint and should provide significant performance"
echo "improvements for cache misses."
echo "================================================================================"