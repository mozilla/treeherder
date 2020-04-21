import json

from django.utils.timezone import now as django_now

from treeherder.perf.models import BackfillRecord, BackfillReport


class TestBackfillReportClass:
    def test_is_outdated_is_synced_with_related_summary(self, test_perf_alert_summary):
        backfill_record = BackfillReport.objects.create(summary=test_perf_alert_summary)

        assert backfill_record.is_outdated is False

        # now change summary, so it's more recent that its report
        test_perf_alert_summary.last_updated = django_now()
        test_perf_alert_summary.save()

        assert backfill_record.is_outdated is True

    def test_last_updated_is_synced_with_child_records(
        self, test_perf_alert, backfill_record_context
    ):
        test_summary = test_perf_alert.summary
        context_dump = json.dumps(backfill_record_context)

        backfill_report = BackfillReport.objects.create(summary=test_summary)
        last_updated_before_new_record = backfill_report.last_updated

        # this should re update the report
        BackfillRecord.objects.create(
            alert=test_perf_alert, report=backfill_report, context=context_dump
        )
        assert last_updated_before_new_record < backfill_report.last_updated

        # record bulk deletes count as report updates too
        last_updated_before_expelling_records = backfill_report.last_updated

        backfill_report.expel_records()
        assert last_updated_before_expelling_records < backfill_report.last_updated

        # deleting single record counts are report update too
        new_backfill_record = BackfillRecord.objects.create(
            alert=test_perf_alert, report=backfill_report, context=context_dump
        )
        last_updated_before_single_record_delete = backfill_report.last_updated

        new_backfill_record.delete()
        assert last_updated_before_single_record_delete < backfill_report.last_updated
