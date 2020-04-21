from datetime import datetime, timedelta

import pytest
import simplejson as json
from mock import Mock, patch

from treeherder.perf.models import BackfillRecord, BackfillReport, PerformanceSettings
from treeherder.perf.secretary_tool import SecretaryTool, default_serializer


@pytest.fixture
def performance_settings(db):
    settings = {
        "limits": 500,
        "last_reset_date": datetime.utcnow(),
    }
    return PerformanceSettings.objects.create(
        name="perf_sheriff_bot", settings=json.dumps(settings, default=default_serializer),
    )


@pytest.fixture
def expired_performance_settings(db):
    settings = {
        "limits": 500,
        "last_reset_date": datetime.utcnow() - timedelta(days=30),
    }
    return PerformanceSettings.objects.create(
        name="perf_sheriff_bot", settings=json.dumps(settings, default=default_serializer),
    )


@pytest.fixture
def create_record():
    def _create_record(alert):
        report = BackfillReport.objects.create(summary=alert.summary)
        return BackfillRecord.objects.create(alert=alert, report=report)

    return _create_record


def test_secretary_tool_updates_only_matured_reports(
    test_perf_alert, test_perf_alert_2, create_record
):
    # create new report with records
    create_record(test_perf_alert)
    # create mature report with records
    date_past = datetime.utcnow() - timedelta(hours=5)
    with patch('django.utils.timezone.now', Mock(return_value=date_past)):
        create_record(test_perf_alert_2)

    assert BackfillRecord.objects.count() == 2
    assert BackfillRecord.objects.filter(status=BackfillRecord.PRELIMINARY).count() == 2

    SecretaryTool.mark_reports_for_backfill()
    assert BackfillRecord.objects.filter(status=BackfillRecord.PRELIMINARY).count() == 1


def test_secretary_tool_uses_existing_settings(performance_settings):
    assert PerformanceSettings.objects.count() == 1
    last_reset_date_before = json.loads(performance_settings.settings)["last_reset_date"]

    SecretaryTool.validate_settings()

    assert PerformanceSettings.objects.count() == 1
    settings_after = PerformanceSettings.objects.filter(name="perf_sheriff_bot").first()
    assert json.loads(settings_after.settings)["last_reset_date"] == last_reset_date_before


def test_secretary_tool_resets_settings_if_expired(expired_performance_settings):
    assert PerformanceSettings.objects.count() == 1
    expired_last_reset_date = json.loads(expired_performance_settings.settings)["last_reset_date"]

    SecretaryTool.validate_settings()

    assert PerformanceSettings.objects.count() == 1
    settings_after = PerformanceSettings.objects.filter(name="perf_sheriff_bot").first()
    assert json.loads(settings_after.settings)["last_reset_date"] != expired_last_reset_date


def test_secretary_tool_creates_new_settings_if_none_exist(db):
    assert PerformanceSettings.objects.count() == 0

    SecretaryTool.validate_settings()

    assert PerformanceSettings.objects.count() == 1
