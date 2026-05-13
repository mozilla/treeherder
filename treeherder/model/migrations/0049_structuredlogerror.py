from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("model", "0048_alter_failureline_action"),
    ]

    operations = [
        migrations.CreateModel(
            name="StructuredLogError",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("action", models.CharField(blank=True, max_length=32)),
                ("time", models.BigIntegerField(blank=True, null=True)),
                ("thread", models.CharField(blank=True, max_length=255)),
                ("pid", models.PositiveIntegerField(blank=True, null=True)),
                ("source", models.CharField(blank=True, max_length=255)),
                ("message", models.TextField(blank=True)),
                ("level", models.CharField(blank=True, max_length=16)),
                (
                    "job_log",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="structured_log_error",
                        to="model.joblog",
                    ),
                ),
            ],
            options={
                "db_table": "structured_log_error",
                "indexes": [
                    models.Index(fields=["job_log"], name="structured__job_log_idx"),
                ],
            },
        ),
    ]
