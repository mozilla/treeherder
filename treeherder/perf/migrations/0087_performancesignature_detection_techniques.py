from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("perf", "0086_backfillrecord_needs_bisection"),
    ]

    operations = [
        migrations.AddField(
            model_name="performancesignature",
            name="detection_techniques",
            field=models.JSONField(null=True),
        ),
    ]
