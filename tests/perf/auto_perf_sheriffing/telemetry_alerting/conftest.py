from datetime import datetime
from unittest.mock import Mock

import pytest

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import TelemetryAlert
from treeherder.perf.models import (
    PerformanceTelemetryAlert,
    PerformanceTelemetryAlertSummary,
    PerformanceTelemetrySignature,
)


@pytest.fixture
def detection_push(create_push, test_repository):
    return create_push(
        test_repository,
        revision="abcdef123456",
        author="test@mozilla.com",
        time=datetime(2024, 1, 15, 12, 0, 0),
    )


@pytest.fixture
def prev_push(create_push, test_repository):
    return create_push(
        test_repository,
        revision="prev123456",
        author="test@mozilla.com",
        time=datetime(2024, 1, 14, 12, 0, 0),
    )


@pytest.fixture
def next_push(create_push, test_repository):
    return create_push(
        test_repository,
        revision="next123456",
        author="test@mozilla.com",
        time=datetime(2024, 1, 16, 12, 0, 0),
    )


@pytest.fixture
def test_telemetry_signature(db):
    return PerformanceTelemetrySignature.objects.create(
        channel="Nightly",
        platform="Windows",
        probe="networking_http_channel_page_open_to_first_sent",
        probe_type="Glean",
        application="Firefox",
    )


@pytest.fixture
def test_telemetry_alert_summary(
    test_repository, test_perf_framework, detection_push, prev_push, next_push, test_issue_tracker
):
    return PerformanceTelemetryAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_framework,
        prev_push=prev_push,
        push=next_push,
        original_push=detection_push,
        manually_created=False,
        created=datetime(2024, 1, 16, 13, 0, 0),
        issue_tracker=test_issue_tracker,
    )


@pytest.fixture
def telemetry_alert_obj(
    test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
):
    return TelemetryAlert(
        test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
    )


@pytest.fixture
def mock_probe():
    """Mock probe for testing with default configuration."""
    probe = Mock()
    probe.name = "test_probe_metric"
    probe.get_notification_emails.return_value = ["test@mozilla.com"]
    probe.should_file_bug.return_value = True
    probe.should_email.return_value = False
    return probe


@pytest.fixture
def base_metric_info():
    """Base metric info structure matching real telemetry data."""
    return {
        "name": "networking_http_channel_page_open_to_first_sent",
        "data": {
            "name": "networking.http_channel_page_open_to_first_sent",
            "description": "Time in milliseconds from AsyncOpen to first byte of request sent",
            "tags": ["Core :: Networking"],
            "in_source": True,
            "latest_fx_release_version": "143.0",
            "extra_keys": None,
            "type": "timing_distribution",
            "expires": None,
            "expiry_text": "never",
            "sampled": False,
            "sampled_text": "Not sampled",
            "is_part_of_info_section": False,
            "bugs": ["https://bugzilla.mozilla.org/show_bug.cgi?id=1697480"],
            "has_annotation": False,
            "origin": "gecko",
        },
        "platform": "desktop",
    }


@pytest.fixture
def metric_info_with_alert(base_metric_info):
    """Metric info with alert=True and bugzilla_notification_emails."""
    base_metric_info["data"]["monitor"] = {
        "alert": True,
        "bugzilla_notification_emails": ["email@fake.fake.com"],
    }
    return base_metric_info


@pytest.fixture
def alert_without_bug(test_telemetry_alert_summary, test_telemetry_signature):
    """Create a TelemetryAlert object without a bug number."""
    from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
        TelemetryAlertFactory,
    )

    alert_row = PerformanceTelemetryAlert.objects.create(
        summary=test_telemetry_alert_summary,
        series_signature=test_telemetry_signature,
        is_regression=True,
        amount_pct=15.5,
        amount_abs=100.0,
        prev_value=645.5,
        new_value=745.5,
        sustained=True,
        direction="increase",
        confidence=0.95,
        prev_median=650.0,
        new_median=750.0,
        prev_p90=700.0,
        new_p90=800.0,
        prev_p95=720.0,
        new_p95=820.0,
        bug_number=None,
        notified=False,
    )
    return TelemetryAlertFactory.construct_alert(alert_row)


@pytest.fixture
def alert_with_bug(test_telemetry_alert_summary, test_telemetry_signature):
    """Create a TelemetryAlert object with a bug number."""
    from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
        TelemetryAlertFactory,
    )

    alert_row = PerformanceTelemetryAlert.objects.create(
        summary=test_telemetry_alert_summary,
        series_signature=test_telemetry_signature,
        is_regression=True,
        amount_pct=15.5,
        amount_abs=100.0,
        prev_value=645.5,
        new_value=745.5,
        sustained=True,
        direction="increase",
        confidence=0.95,
        prev_median=650.0,
        new_median=750.0,
        prev_p90=700.0,
        new_p90=800.0,
        prev_p95=720.0,
        new_p95=820.0,
        bug_number=123456,
        notified=False,
    )
    return TelemetryAlertFactory.construct_alert(alert_row)


@pytest.fixture
def create_telemetry_alert(test_telemetry_alert_summary):
    """Factory fixture to create telemetry alerts with custom parameters."""

    def _create_alert(signature, **kwargs):
        defaults = {
            "is_regression": True,
            "amount_pct": 15.5,
            "amount_abs": 100.0,
            "prev_value": 645.5,
            "new_value": 745.5,
            "sustained": True,
            "direction": "increase",
            "confidence": 0.95,
            "prev_median": 650.0,
            "new_median": 750.0,
            "prev_p90": 700.0,
            "new_p90": 800.0,
            "prev_p95": 720.0,
            "new_p95": 820.0,
            "bug_number": None,
            "notified": False,
            "summary": test_telemetry_alert_summary,
        }
        defaults.update(kwargs)
        return PerformanceTelemetryAlert.objects.create(series_signature=signature, **defaults)

    return _create_alert


@pytest.fixture
def create_telemetry_signature():
    """Factory fixture to create telemetry signatures with custom parameters."""

    def _create_signature(**kwargs):
        defaults = {
            "channel": "Nightly",
            "platform": "Windows",
            "probe": "test_probe",
            "probe_type": "Glean",
            "application": "Firefox",
        }
        defaults.update(kwargs)
        return PerformanceTelemetrySignature.objects.create(**defaults)

    return _create_signature


@pytest.fixture
def test_telemetry_alert(create_telemetry_signature, create_telemetry_alert):
    return create_telemetry_alert(create_telemetry_signature())
