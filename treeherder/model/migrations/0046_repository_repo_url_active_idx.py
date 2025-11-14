from django.db import migrations

class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('model', '0045_alter_failureline_expected_alter_failureline_level_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS repo_url_active_idx ON repository (url, active_status);',
            reverse_sql='DROP INDEX IF EXISTS repo_url_active_idx;',
        ),
    ]