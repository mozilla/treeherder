from django.db import migrations, models, connection
import django.db.models.deletion


def check_perfdatum_pk(apps, schema_editor):
    """Ensure performance_datum FK has been updated to bigint type"""

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COLUMN_TYPE from INFORMATION_SCHEMA.COLUMNS WHERE "
            "table_schema = 'treeherder' and "
            "table_name = 'performance_datum' "
            "and COLUMN_NAME = 'id'"
        )
        (column_type,) = cursor.fetchone()
        assert (
            column_type == "bigint(20)"
        ), f"PerformanceDatum PK column type is {column_type} but should be bigint(20)"


class Migration(migrations.Migration):
    """This migration updates the django_migrations table and restore perf_multicommitdatum FK
    toward the performance_datum table, after its PK has manually been updated to bigint.
    """

    dependencies = [
        ('perf', '0043_drop_multicommitdatum'),
    ]

    operations = [
        # Ensure the PK has been updated
        migrations.RunPython(
            check_perfdatum_pk,
            reverse_code=migrations.RunPython.noop,
        ),
        # Empty SQL migration that update django state schema
        migrations.RunSQL(
            migrations.RunSQL.noop,
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[
                migrations.AlterField(
                    model_name='performancedatum',
                    name='id',
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
            ],
        ),
        # Restore MultiCommitDatum FK to PerformanceDatum
        migrations.CreateModel(
            name='MultiCommitDatum',
            fields=[
                (
                    'perf_datum',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name='multi_commit_datum',
                        serialize=False,
                        to='perf.performancedatum',
                    ),
                ),
            ],
        ),
    ]
