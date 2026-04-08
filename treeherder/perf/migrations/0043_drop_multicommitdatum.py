from django.db import migrations


def check_no_multicommitdatum(apps, schema_editor):
    MultiCommitDatum = apps.get_model("perf", "MultiCommitDatum")
    assert (
        not MultiCommitDatum.objects.exists()
    ), "MultiCommitDatum table must be empty to migrate PerformanceDatum PK"


class Migration(migrations.Migration):
    """This migration drops the perf_multicommitdatum table in order to perform
    performance_datum PK migration from INT(11) to BIGINT(20) using an external
    tool, percona toolkit's online schema change (pt-osc).
    Any access to MultiCommitDatum may create errors until migration perf.0046 has been applied.
    """

    dependencies = [
        ("perf", "0042_backfillrecord_new_fields"),
    ]

    operations = [
        migrations.RunPython(
            check_no_multicommitdatum,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.DeleteModel(
            name="MultiCommitDatum",
        ),
    ]
