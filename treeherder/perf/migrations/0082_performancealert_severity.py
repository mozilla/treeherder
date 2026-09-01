from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("perf", "0081_perfcomparemwucache"),
    ]

    operations = [
        migrations.AddField(
            model_name="performancealertsummary",
            name="severity",
            field=models.CharField(
                choices=[
                    ("critical", "critical"),
                    ("subcritical", "subcritical"),
                    ("normal", "normal"),
                ],
                default=None,
                max_length=80,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="performancealert",
            name="severity",
            field=models.CharField(
                choices=[
                    ("critical", "critical"),
                    ("subcritical", "subcritical"),
                    ("normal", "normal"),
                ],
                default=None,
                max_length=80,
                null=True,
            ),
        ),
    ]
