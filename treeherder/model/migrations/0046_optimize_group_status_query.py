# Generated migration to optimize group status query performance

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("model", "0045_auto_20250807_1713"),
    ]

    operations = [
        # Add composite index on Job table for repository and push time filtering
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_job_repo_push_time ON job(repository_id, push_id);",
            reverse_sql="DROP INDEX IF EXISTS idx_job_repo_push_time;",
        ),
        # Add index on job_type name for prefix searches
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_job_type_name_prefix ON job_type(name(10));",
            reverse_sql="DROP INDEX IF EXISTS idx_job_type_name_prefix;",
        ),
        # Add composite index on group_status for job_log and status filtering
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_group_status_joblog_status ON group_status(job_log_id, status);",
            reverse_sql="DROP INDEX IF EXISTS idx_group_status_joblog_status;",
        ),
        # Add index on push time for range queries
        migrations.RunSQL(
            "CREATE INDEX IF NOT EXISTS idx_push_time_repo ON push(time, repository_id);",
            reverse_sql="DROP INDEX IF EXISTS idx_push_time_repo;",
        ),
    ]
