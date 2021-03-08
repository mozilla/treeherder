import datetime
from typing import Tuple

from treeherder.perf.auto_perf_sheriffing.backfill_reports import (
    BackfillReportMaintainer,
)
from treeherder.perf.models import (
    BackfillRecord,
    BackfillReport,
    PerformanceAlert,
)

EPOCH = datetime.datetime.utcfromtimestamp(0)


def test_reports_are_generated_for_relevant_alerts_only(
    test_perf_alert_summary,
    test_perf_framework,
    test_repository,
    create_alerts,
    alerts_picker,
    mock_backfill_context_fetcher,
):
    create_alerts(test_perf_alert_summary, relevant=False, amount=1)  # irrelevant alert

    report_maintainer = BackfillReportMaintainer(alerts_picker, mock_backfill_context_fetcher)

    report_maintainer.provide_updated_reports(
        since=EPOCH, frameworks=[test_perf_framework.name], repositories=[test_repository.name]
    )

    assert not BackfillReport.objects.exists()


def test_running_report_twice_on_unchanged_data_doesnt_change_anything(
    test_perf_alert_summary,
    test_perf_framework,
    test_repository,
    create_alerts,
    alerts_picker,
    mock_backfill_context_fetcher,
):
    create_alerts(test_perf_alert_summary, amount=3)  # relevant alerts
    create_alerts(test_perf_alert_summary, relevant=False, amount=1)  # irrelevant alert

    assert not BackfillReport.objects.exists()

    report_maintainer = BackfillReportMaintainer(alerts_picker, mock_backfill_context_fetcher)

    # run report once
    report_maintainer.provide_updated_reports(
        since=EPOCH, frameworks=[test_perf_framework.name], repositories=[test_repository.name]
    )
    initial_records_timestamps, initial_report_timestamps = __fetch_report_timestamps(
        test_perf_alert_summary
    )

    # run report twice (no changes happened on underlying data)
    report_maintainer.provide_updated_reports(
        since=EPOCH, frameworks=[test_perf_framework.name], repositories=[test_repository.name]
    )
    records_timestamps, report_timestamps = __fetch_report_timestamps(test_perf_alert_summary)

    assert initial_report_timestamps == report_timestamps
    assert initial_records_timestamps == records_timestamps


def test_reports_are_updated_after_alert_summaries_change(
    test_perf_alert_summary,
    test_perf_framework,
    test_repository,
    create_alerts,
    alerts_picker,
    mock_backfill_context_fetcher,
):
    relevant_alerts = create_alerts(
        test_perf_alert_summary, amount=3
    )  # relevant alerts, all regressions
    create_alerts(test_perf_alert_summary, relevant=False, amount=1)  # irrelevant alert

    assert not BackfillReport.objects.exists()

    report_maintainer = BackfillReportMaintainer(alerts_picker, mock_backfill_context_fetcher)

    report_maintainer.provide_updated_reports(
        since=EPOCH, frameworks=[test_perf_framework.name], repositories=[test_repository.name]
    )

    assert BackfillReport.objects.count() == 1
    assert BackfillRecord.objects.count() == 3

    # new alerts will cause report updates
    create_alerts(test_perf_alert_summary, amount=3)  # relevant alerts
    report_maintainer.provide_updated_reports(
        since=EPOCH, frameworks=[test_perf_framework.name], repositories=[test_repository.name]
    )

    assert BackfillRecord.objects.count() == 5

    # any change to a summary's alert will cause report updates
    alert = relevant_alerts[0]
    alert.status = PerformanceAlert.ACKNOWLEDGED
    alert.save()
    initial_report_timestamps, initial_records_timestamps = __fetch_report_timestamps(
        test_perf_alert_summary
    )
    report_maintainer.provide_updated_reports(
        since=EPOCH, frameworks=[test_perf_framework.name], repositories=[test_repository.name]
    )

    report_timestamps, records_timestamps = __fetch_report_timestamps(test_perf_alert_summary)
    assert initial_report_timestamps != report_timestamps
    assert initial_records_timestamps != records_timestamps


def __fetch_report_timestamps(test_perf_alert_summary) -> Tuple:
    report = BackfillReport.objects.get(summary=test_perf_alert_summary)
    report_timestamps = report.created, report.last_updated
    records_timestamps = [record.created for record in report.records.all()]
    return records_timestamps, report_timestamps
