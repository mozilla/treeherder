"""This migration automatically updates performance_datum.id column to Bigint(20).
On large tables or production environment, it is recommanded to use an external tool (e.g. pt-osc)
to update the column and fake this migration. Migration perf.0045 will restore a valid django's schema.
"""
from django.db import migrations, connection


def alter_perfdatum_pk(apps, schema_editor):
    PerformanceDatum = apps.get_model('perf', 'PerformanceDatum')
    pursue = "yes"
    # Automatically pursue migration if performance_datum table is empty
    # This is useful for scenarios running initial migration like tests
    if PerformanceDatum.objects.exists():
        pursue = input(
            "This operation will ALTER performance_datum PK to BIGINT(20). It is recommended to use an external tool "
            "(e.g. pt-osc) on large tables. Do you want to continue ? [Y/n]"
        )
    if pursue.lower() not in ('', 'y', 'yes'):
        raise Exception("Aborting…")
    with connection.cursor() as cursor:
        cursor.execute(
            "ALTER TABLE performance_datum MODIFY COLUMN id BIGINT(20) NOT NULL AUTO_INCREMENT"
        )
        return


class Migration(migrations.Migration):
    dependencies = [
        ('perf', '0043_drop_multicommitdatum'),
    ]

    operations = [
        migrations.RunPython(alter_perfdatum_pk),
    ]
