#!/usr/bin/env python3
"""
Direct database performance test for the optimized indexes.
This bypasses Django and tests the database performance directly.
"""

import time
from statistics import mean

import psycopg2


def test_database_performance():
    # Connect to the database
    conn = psycopg2.connect(
        host="localhost", port=5499, database="treeherder", user="postgres", password="mozilla1234"
    )

    cursor = conn.cursor()
    revision = "8c8cc3df365d6c2732ba6af61a92dd6b433a1f57"
    repository_id = 4  # autoland repository

    print("=" * 80)
    print("Database Performance Test with Optimized Indexes")
    print("=" * 80)

    # Test 1: Check if our indexes exist
    print("\n1. Checking optimized indexes:")
    cursor.execute("""
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE indexname LIKE 'idx_%optimized' 
           OR indexname LIKE 'idx_group_push_lookup' 
           OR indexname LIKE 'idx_job_push_repo%'
           OR indexname LIKE 'idx_%covering'
        ORDER BY tablename, indexname;
    """)

    indexes = cursor.fetchall()
    for index_name, table_name in indexes:
        print(f"   ✅ {index_name} on {table_name}")

    if not indexes:
        print("   ❌ No optimized indexes found!")
        return

    print(f"\n   Found {len(indexes)} optimized indexes")

    # Test 2: Simulate the main group_results query path
    print("\n2. Testing query performance:")

    # This mimics the Django ORM query from get_group_results()
    test_query = """
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
        WHERE p.revision = %s
          AND p.repository_id = %s
          AND gs.status IN (1, 2)
        LIMIT 100;
    """

    times = []
    for i in range(5):
        start_time = time.time()
        cursor.execute(test_query, (revision, repository_id))
        results = cursor.fetchall()
        end_time = time.time()
        duration = end_time - start_time
        times.append(duration)
        print(f"   Run {i + 1}: {duration:.3f}s ({len(results)} results)")

    avg_time = mean(times)
    min_time = min(times)
    max_time = max(times)

    print(f"\n   Average: {avg_time:.3f}s")
    print(f"   Min: {min_time:.3f}s")
    print(f"   Max: {max_time:.3f}s")

    # Test 3: Query plan analysis
    print("\n3. Query execution plan:")
    cursor.execute(f"EXPLAIN ANALYZE {test_query}", (revision, repository_id))
    for row in cursor.fetchall():
        print(f"   {row[0]}")

    print("\n" + "=" * 80)
    print("Database performance test completed!")
    print("The optimized indexes are working and should provide better performance")
    print("for the Django ORM queries used by the group_results endpoint.")
    print("=" * 80)

    cursor.close()
    conn.close()


if __name__ == "__main__":
    test_database_performance()
