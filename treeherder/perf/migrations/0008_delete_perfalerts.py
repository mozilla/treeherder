from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [("perf", "0007_alert_status")]

    operations = [
        migrations.DeleteModel("PerformanceAlert"),
        migrations.DeleteModel("PerformanceAlertSummary")
    ]
