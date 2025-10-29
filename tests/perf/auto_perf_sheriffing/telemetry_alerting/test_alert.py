import pytest

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
    TelemetryAlert,
    TelemetryAlertBuildError,
    TelemetryAlertFactory,
)


class TestTelemetryAlert:
    def test_initialization(
        self, test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
    ):
        """Test TelemetryAlert object initialization."""
        alert = TelemetryAlert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )

        assert alert.telemetry_alert == test_telemetry_alert
        assert alert.telemetry_alert_summary == test_telemetry_alert_summary
        assert alert.telemetry_signature == test_telemetry_signature
        assert alert.related_telemetry_alerts is None
        assert alert.detection_range is None
        assert alert.failed is False

    def test_get_related_alerts_empty(self, telemetry_alert_obj):
        """Test getting related alerts when none exist."""
        related_alerts = telemetry_alert_obj.get_related_alerts()

        assert related_alerts.count() == 0
        # Verify it's cached
        assert telemetry_alert_obj.related_telemetry_alerts is not None

    def test_get_related_alerts_with_multiple_alerts(
        self, telemetry_alert_obj, create_telemetry_signature, create_telemetry_alert
    ):
        """Test getting related alerts when multiple alerts exist in the same summary."""
        # Create additional alerts in the same summary
        sig2 = create_telemetry_signature(probe="memory_ghost_windows")
        alert2 = create_telemetry_alert(sig2)

        sig3 = create_telemetry_signature(probe="cycle_collector_time")
        alert3 = create_telemetry_alert(sig3)

        related_alerts = telemetry_alert_obj.get_related_alerts()

        assert related_alerts.count() == 2
        alert_ids = [alert.id for alert in related_alerts]
        assert alert2.id in alert_ids
        assert alert3.id in alert_ids
        assert telemetry_alert_obj.telemetry_alert.id not in alert_ids

    def test_get_related_alerts_uses_cache(self, telemetry_alert_obj):
        """Test that get_related_alerts uses cached value on subsequent calls."""
        first_call = telemetry_alert_obj.get_related_alerts()
        second_call = telemetry_alert_obj.get_related_alerts()

        # QuerySets are not the same object, but the cached attribute should be set
        assert telemetry_alert_obj.related_telemetry_alerts is not None
        assert list(first_call) == list(second_call)

    def test_get_detection_range(self, telemetry_alert_obj, prev_push, next_push, detection_push):
        """Test getting the detection range."""
        detection_range = telemetry_alert_obj.get_detection_range()

        assert detection_range["from"] == prev_push
        assert detection_range["to"] == next_push
        assert detection_range["detection"] == detection_push

    def test_get_detection_range_uses_cache(self, telemetry_alert_obj):
        """Test that get_detection_range uses cached value on subsequent calls."""
        first_call = telemetry_alert_obj.get_detection_range()
        second_call = telemetry_alert_obj.get_detection_range()

        assert first_call is second_call

    def test_str_representation(self, telemetry_alert_obj, test_telemetry_alert):
        """Test string representation of TelemetryAlert."""
        str_repr = str(telemetry_alert_obj)

        assert "TelemetryAlert" in str_repr
        assert f"alertID={test_telemetry_alert.id}" in str_repr
        assert f"alertSummaryID={test_telemetry_alert.summary.id}" in str_repr
        assert "probe=networking_http_channel_page_open_to_first_sent" in str_repr
        assert "platform=Windows" in str_repr


class TestTelemetryAlertFactory:
    def test_construct_alert_with_all_parameters(
        self, test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
    ):
        """Test constructing alert with all parameters provided."""
        alert = TelemetryAlertFactory.construct_alert(
            telemetry_alert=test_telemetry_alert,
            telemetry_alert_summary=test_telemetry_alert_summary,
            telemetry_signature=test_telemetry_signature,
        )

        assert isinstance(alert, TelemetryAlert)
        assert alert.telemetry_alert == test_telemetry_alert
        assert alert.telemetry_alert_summary == test_telemetry_alert_summary
        assert alert.telemetry_signature == test_telemetry_signature

    def test_construct_alert_from_row(self, test_telemetry_alert):
        """Test constructing alert from a database row only."""
        alert = TelemetryAlertFactory.construct_alert(telemetry_alert=test_telemetry_alert)

        assert isinstance(alert, TelemetryAlert)
        assert alert.telemetry_alert == test_telemetry_alert
        assert alert.telemetry_alert_summary == test_telemetry_alert.summary
        assert alert.telemetry_signature == test_telemetry_alert.series_signature

    def test_construct_alert_with_no_parameters_raises_error(self):
        """Test that constructing alert with no parameters raises error."""
        with pytest.raises(TelemetryAlertBuildError) as exc_info:
            TelemetryAlertFactory.construct_alert()

        assert "Could not construct TelemetryAlerts from given arguments" in str(exc_info.value)

    def test_construct_alert_with_only_summary_raises_error(self, test_telemetry_alert_summary):
        """Test that constructing alert with only summary raises error."""
        with pytest.raises(TelemetryAlertBuildError) as exc_info:
            TelemetryAlertFactory.construct_alert(
                telemetry_alert_summary=test_telemetry_alert_summary,
            )

        assert "Could not construct TelemetryAlerts from given arguments" in str(exc_info.value)

    def test_build_alert_private_method(
        self, test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
    ):
        """Test the private _build_alert method."""
        alert = TelemetryAlertFactory._build_alert(
            test_telemetry_alert, test_telemetry_alert_summary, test_telemetry_signature
        )

        assert isinstance(alert, TelemetryAlert)
        assert alert.telemetry_alert == test_telemetry_alert
        assert alert.telemetry_alert_summary == test_telemetry_alert_summary
        assert alert.telemetry_signature == test_telemetry_signature

    def test_build_alert_from_row_private_method(self, test_telemetry_alert):
        """Test the private _build_alert_from_row method."""
        alert = TelemetryAlertFactory._build_alert_from_row(test_telemetry_alert)

        assert isinstance(alert, TelemetryAlert)
        assert alert.telemetry_alert == test_telemetry_alert
        assert alert.telemetry_alert_summary == test_telemetry_alert.summary
        assert alert.telemetry_signature == test_telemetry_alert.series_signature
