import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """This migration updates the django_migrations table and restores
    perf_multicommitdatum FK toward the performance_datum table
    """

    dependencies = [
        ('perf', '0044_perfdatum_bigint_fk'),
    ]

    operations = [
        # Empty SQL migration that update django state schema
        migrations.RunSQL(
            migrations.RunSQL.noop,
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
