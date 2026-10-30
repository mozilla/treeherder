from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("perf", "0085_rename_bug_status_performancealertsummary_bug_resolution"),
    ]

    operations = [
        migrations.AddField(
            model_name="performancesignature",
            name="detection_techniques",
            field=models.JSONField(null=True),
        ),
    ]
