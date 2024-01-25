from django.db import migrations, models, connection
from django.conf import settings
import django.db.models.deletion
from django.db.utils import DatabaseError


def check_perfdatum_pk(apps, schema_editor):
    """Ensure performance_datum FK has been updated to bigint type"""

    # Not needed on postgresql
    if settings.DATABASES["default"]["ENGINE"] != "django.db.backends.mysql":
        return

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COLUMN_TYPE from INFORMATION_SCHEMA.COLUMNS WHERE "
            f"""table_schema = '{connection.settings_dict["NAME"]}' and """
            "table_name = 'performance_datum' and "
            "COLUMN_NAME = 'id'"
        )
        column_type = cursor.fetchone()

        if column_type != ("bigint(20)",):
            raise DatabaseError(
                f"PerformanceDatum PK column type is {column_type} but should be bigint(20)"
            )


class Migration(migrations.Migration):
    """This migration updates the django_migrations table and restores
    perf_multicommitdatum FK toward the performance_datum table
    """

    dependencies = [
        ("perf", "0044_perfdatum_bigint_fk"),
    ]

    operations = [
        # Ensure the PK has been updated
        migrations.RunPython(
            check_perfdatum_pk,
        ),
        # Empty SQL migration that update django state schema
        migrations.RunSQL(
            migrations.RunSQL.noop,
            state_operations=[
                migrations.AlterField(
                    model_name="performancedatum",
                    name="id",
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
            ],
        ),
        # Restore MultiCommitDatum FK to PerformanceDatum
        migrations.CreateModel(
            name="MultiCommitDatum",
            fields=[
                (
                    "perf_datum",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="multi_commit_datum",
                        serialize=False,
                        to="perf.performancedatum",
                    ),
                ),
            ],
        ),
    ]
