import datetime
import random
import string
from typing import Tuple
from unittest.mock import Mock

import pytest

from treeherder.model.models import MachinePlatform, Option, OptionCollection
from treeherder.perf.alerts import AlertsPicker, BackfillReportMaintainer
from treeherder.perf.models import (
    BackfillRecord,
    BackfillReport,
    PerformanceAlert,
    PerformanceSignature,
)

LETTERS = string.ascii_lowercase
EPOCH = datetime.datetime.utcfromtimestamp(0)
RANDOM_STRINGS = set()


@pytest.fixture(scope='module')
def alerts_picker():
    # real-world instance
    return AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )


@pytest.fixture
def mock_backfill_context_fetcher(backfill_record_context):
    # because underlying data is hard to provide (performance datum, pushes, jobs etc)
    return Mock(return_value=backfill_record_context)


@pytest.fixture
def option_collection():
    option = Option.objects.create(name='opt')
    return OptionCollection.objects.create(option_collection_hash='my_option_hash', option=option)


@pytest.fixture
def relevant_platform():
    return MachinePlatform.objects.create(os_name='win', platform='windows10', architecture='x86')


@pytest.fixture
def irrelevant_platform():
    return MachinePlatform.objects.create(
        os_name='OS_OF_NO_INTEREST', platform='PLATFORM_OF_NO_INTEREST', architecture='x86'
    )


@pytest.fixture
def unique_random_string():
    global RANDOM_STRINGS, LETTERS

    def _unique_random_string(length=14):
        while True:
            random_string = ''.join(random.choice(LETTERS) for _ in range(length))
            if random_string not in RANDOM_STRINGS:
                RANDOM_STRINGS.add(random_string)
                return random_string

    return _unique_random_string


@pytest.fixture
def create_perf_signature(
    test_repository,
    test_perf_framework,
    option_collection,
    relevant_platform,
    irrelevant_platform,
    unique_random_string,
):
    def _create_perf_signature(relevant=True):
        platform = relevant_platform if relevant else irrelevant_platform

        signature = PerformanceSignature.objects.create(
            repository=test_repository,
            signature_hash=unique_random_string(40),
            framework=test_perf_framework,
            platform=platform,
            option_collection=option_collection,
            suite=unique_random_string(),
            test=unique_random_string(),
            has_subtests=False,
            last_updated=datetime.datetime.now(),
        )
        return signature

    return _create_perf_signature


@pytest.fixture
def create_alerts(create_perf_signature):
    def _create_alerts(summary, relevant=True, amount=3):
        alerts = []
        for _ in range(amount):
            alert = PerformanceAlert.objects.create(
                summary=summary,
                series_signature=create_perf_signature(relevant),
                is_regression=True,
                amount_pct=0.5,
                amount_abs=50.0,
                prev_value=100.0,
                new_value=150.0,
                t_value=20.0,
            )
            alerts.append(alert)
        return alerts

    return _create_alerts


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

    report_timestamps, records_timestmaps = __fetch_report_timestamps(test_perf_alert_summary)
    assert initial_report_timestamps != report_timestamps
    assert initial_records_timestamps != records_timestmaps


def __fetch_report_timestamps(test_perf_alert_summary) -> Tuple:
    report = BackfillReport.objects.get(summary=test_perf_alert_summary)
    report_timestamps = report.created, report.last_updated
    records_timestamps = [record.created for record in report.records.all()]
    return records_timestamps, report_timestamps
