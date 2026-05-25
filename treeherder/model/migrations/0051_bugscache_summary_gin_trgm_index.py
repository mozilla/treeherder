from django.db import migrations


class Migration(migrations.Migration):
    # Non-atomic so the index can be built CONCURRENTLY, avoiding a write lock
    # on the bugscache table while the index is created.
    atomic = False

    dependencies = [
        ("model", "0050_repository_accepts_pull_requests"),
    ]

    operations = [
        # GIN trigram index backing Bugscache.search(), which filters with
        # `summary ILIKE '%term%'` and orders by trigram similarity. The plain
        # btree index on summary cannot serve substring/similarity matching, so
        # this index is what lets those searches use an index scan instead of a
        # sequential scan. Requires the pg_trgm extension (added in 0031).
        migrations.RunSQL(
            sql=(
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS bugscache_summary_gin_trgm_idx "
                "ON bugscache USING gin (summary gin_trgm_ops);"
            ),
            reverse_sql="DROP INDEX IF EXISTS bugscache_summary_gin_trgm_idx;",
        ),
    ]
