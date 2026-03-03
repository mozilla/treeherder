# Generated manually

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("perf", "0063_performancebugtemplate_no_action_required_text"),
    ]

    operations = [
        # Rename fields in PerformanceTelemetryAlert
        migrations.RenameField(
            model_name="performancetelemetryalert",
            old_name="prev_p90",
            new_name="prev_p05",
        ),
        migrations.RenameField(
            model_name="performancetelemetryalert",
            old_name="new_p90",
            new_name="new_p05",
        ),
        # Rename fields in PerformanceAlertTesting
        migrations.RenameField(
            model_name="performancealerttesting",
            old_name="prev_p90",
            new_name="prev_p05",
        ),
        migrations.RenameField(
            model_name="performancealerttesting",
            old_name="new_p90",
            new_name="new_p05",
        ),
    ]
