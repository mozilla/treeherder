from django.db import migrations

RESOLUTION_BY_STATUS = {
    1: "downstream",
    2: "reassigned",
    3: "invalid",
    4: "valid",
    5: "valid",
    6: "valid",
    7: "valid",
    9: "infra",
}
BACKED_OUT_STATUS = 8
BACKED_OUT_TAG = "backed-out"
SUMMARY_MODELS = (
    "PerformanceAlertSummary",
    "PerformanceAlertSummaryTesting",
    "PerformanceTelemetryAlertSummary",
)


def backfill_resolution(apps, schema_editor):
    for model_name in SUMMARY_MODELS:
        model = apps.get_model("perf", model_name)
        for status, resolution in RESOLUTION_BY_STATUS.items():
            model.objects.filter(status=status, resolution__isnull=True).update(
                resolution=resolution
            )

    PerformanceAlertSummary = apps.get_model("perf", "PerformanceAlertSummary")
    PerformanceTag = apps.get_model("perf", "PerformanceTag")

    backed_out_summaries = PerformanceAlertSummary.objects.filter(
        status=BACKED_OUT_STATUS, resolution__isnull=True
    )
    summary_ids = list(backed_out_summaries.values_list("id", flat=True))
    if not summary_ids:
        return

    backed_out_summaries.update(resolution="valid")
    tag, _ = PerformanceTag.objects.get_or_create(name=BACKED_OUT_TAG)

    through = PerformanceTag.alert_summaries.through
    through.objects.bulk_create(
        [
            through(performancetag_id=tag.id, performancealertsummary_id=summary_id)
            for summary_id in summary_ids
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("perf", "0086_performancealertsummary_resolution_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_resolution, migrations.RunPython.noop),
    ]
