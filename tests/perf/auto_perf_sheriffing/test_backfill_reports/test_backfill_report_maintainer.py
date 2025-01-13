import datetime
import random

from treeherder.perf.auto_perf_sheriffing.backfill_reports import (
    BackfillReportMaintainer,
)
from treeherder.perf.models import BackfillRecord, BackfillReport, PerformanceAlert

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


def test_pick_important_alerts(
    test_perf_alert_summary, create_alerts, alerts_picker, mock_backfill_context_fetcher
):
    untriaged_alerts = create_alerts(test_perf_alert_summary, amount=10)
    report_maintainer = BackfillReportMaintainer(alerts_picker, mock_backfill_context_fetcher)

    # make some of the alerts INVALID and ACKNOWLEDGED so that there aren't only UNTRIAGED alerts
    triaged_alerts_indexes = random.sample(range(0, 10), 5)
    status_choices = [
        PerformanceAlert.INVALID,
        PerformanceAlert.ACKNOWLEDGED,
    ]
    for idx in triaged_alerts_indexes:
        alert = untriaged_alerts[idx]
        alert.status = random.choice(status_choices)
        alert.save()

    # important alerts can have only the status UNTRIAGED
    important_alerts = report_maintainer._pick_important_alerts(
        from_summary=test_perf_alert_summary
    )
    all_alerts = PerformanceAlert.objects.all()
    triaged_alerts = PerformanceAlert.objects.exclude(status=PerformanceAlert.UNTRIAGED)
    assert set(important_alerts).intersection(set(all_alerts)) == set(important_alerts)
    assert set(important_alerts).intersection(set(triaged_alerts)) == set([])


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
    assert BackfillRecord.objects.count() == 1

    # new alerts will cause report updates
    create_alerts(test_perf_alert_summary, amount=3)  # relevant alerts
    report_maintainer.provide_updated_reports(
        since=EPOCH, frameworks=[test_perf_framework.name], repositories=[test_repository.name]
    )

    assert BackfillRecord.objects.count() == 1

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


def __fetch_report_timestamps(test_perf_alert_summary) -> tuple:
    report = BackfillReport.objects.get(summary=test_perf_alert_summary)
    report_timestamps = report.created, report.last_updated
    records_timestamps = [record.created for record in report.records.all()]
    return records_timestamps, report_timestamps
