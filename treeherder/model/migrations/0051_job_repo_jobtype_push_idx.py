from django.db import migrations, models


class Migration(migrations.Migration):
    # Use non-atomic so we can create the index CONCURRENTLY (the job table is
    # large in production and a blocking build would lock out ingestion).
    atomic = False

    dependencies = [
        ("model", "0050_repository_accepts_pull_requests"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "CREATE INDEX CONCURRENTLY IF NOT EXISTS job_repo_jobtype_push_idx "
                        "ON job (repository_id, job_type_id, push_id);"
                    ),
                    reverse_sql="DROP INDEX IF EXISTS job_repo_jobtype_push_idx;",
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name="job",
                    index=models.Index(
                        fields=["repository", "job_type", "push"],
                        name="job_repo_jobtype_push_idx",
                    ),
                ),
            ],
        ),
    ]
