from django.db import migrations
from django.db.models import Q

# sp3 score on shippable Windows and applink on the a55 are the only tests that
# were treated as critical before severities were recorded. Alerts on anything
# else keep a null severity.
CRITICAL_SIGNATURES = (
    {
        "suite": "speedometer3",
        "test": "score",
        "platform__platform": "windows11-64-24h2-shippable",
        "application": "firefox",
    },
    {
        "suite": "newssite-applink-startup",
        "test": "applink_startup",
        "platform__platform": "android-hw-a55-14-0-aarch64-shippable",
        "application": "fenix",
    },
)


def backfill_severity(apps, schema_editor):
    PerformanceAlert = apps.get_model("perf", "PerformanceAlert")
    PerformanceAlertSummary = apps.get_model("perf", "PerformanceAlertSummary")
    PerformanceSignature = apps.get_model("perf", "PerformanceSignature")

    critical = Q()
    for rule in CRITICAL_SIGNATURES:
        critical |= Q(**rule)
    critical_signatures = PerformanceSignature.objects.filter(critical).values_list("id", flat=True)

    backfilled = PerformanceAlert.objects.filter(
        severity__isnull=True, series_signature_id__in=list(critical_signatures)
    )
    # read the summaries before the update, while the alerts still match
    critical_summaries = set(backfilled.values_list("summary_id", flat=True))
    backfilled.update(severity="critical")

    PerformanceAlertSummary.objects.filter(
        severity__isnull=True, id__in=critical_summaries
    ).update(severity="critical")


class Migration(migrations.Migration):
    dependencies = [
        ("perf", "0082_performancealert_severity"),
    ]

    operations = [
        migrations.RunPython(backfill_severity, migrations.RunPython.noop),
    ]
