from django.db import migrations, models


class Migration(migrations.Migration):
    # Use non-atomic so we can create the index CONCURRENTLY
    atomic = False

    dependencies = [
        ('model', '0045_alter_failureline_expected_alter_failureline_level_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS repo_url_active_idx ON repository (url, active_status);",
                    reverse_sql="DROP INDEX IF EXISTS repo_url_active_idx;",
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='repository',
                    index=models.Index(fields=['url', 'active_status'], name='repo_url_active_idx'),
                ),
            ],
        ),
    ]
