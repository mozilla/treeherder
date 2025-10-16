from unittest.mock import Mock, patch

import pytest

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.probe import (
    TelemetryProbe,
    TelemetryProbeValidationError,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    DEFAULT_CHANGE_DETECTION,
)


@pytest.fixture
def metric_info_with_monitor_only(base_metric_info):
    """Metric info with alert=False and bugzilla_notification_emails."""
    base_metric_info["data"]["monitor"] = {
        "alert": False,
        "bugzilla_notification_emails": ["email@fake.fake.com"],
    }
    return base_metric_info


@pytest.fixture
def metric_info_with_bool_true(base_metric_info):
    """Metric info with monitor as boolean True."""
    base_metric_info["data"]["monitor"] = True
    return base_metric_info


@pytest.fixture
def metric_info_with_bool_false(base_metric_info):
    """Metric info with monitor as boolean False."""
    base_metric_info["data"]["monitor"] = False
    return base_metric_info


@pytest.fixture
def metric_info_with_empty_dict(base_metric_info):
    """Metric info with monitor as empty dictionary."""
    base_metric_info["data"]["monitor"] = {}
    return base_metric_info


@pytest.fixture
def metric_info_with_none(base_metric_info):
    """Metric info with monitor as None."""
    base_metric_info["data"]["monitor"] = None
    return base_metric_info


class TestTelemetryProbeInitialization:
    def test_initialization_with_alert_true(self, metric_info_with_alert):
        """Test probe initialization with alert=True."""
        probe = TelemetryProbe(metric_info_with_alert)

        assert probe.name == "networking_http_channel_page_open_to_first_sent"
        assert probe.metric_info == metric_info_with_alert
        assert probe.monitor_info["detect_changes"] is True
        assert probe.monitor_info["alert"] is True
        assert probe.monitor_info["bugzilla_notification_emails"] == ["email@fake.fake.com"]

    def test_initialization_with_monitor_only(self, metric_info_with_monitor_only):
        """Test probe initialization with alert=False."""
        probe = TelemetryProbe(metric_info_with_monitor_only)

        assert probe.name == "networking_http_channel_page_open_to_first_sent"
        assert probe.monitor_info["detect_changes"] is True
        assert probe.monitor_info["alert"] is False

    def test_initialization_with_bool_true(self, metric_info_with_bool_true):
        """Test probe initialization with monitor as boolean True."""
        probe = TelemetryProbe(metric_info_with_bool_true)

        assert probe.monitor_info["detect_changes"] is True
        assert "alert" not in probe.monitor_info

    def test_initialization_with_bool_false(self, metric_info_with_bool_false):
        """Test probe initialization with monitor as boolean False."""
        probe = TelemetryProbe(metric_info_with_bool_false)

        assert probe.monitor_info["detect_changes"] is False

    def test_initialization_with_empty_dict(self, metric_info_with_empty_dict):
        """Test probe initialization with monitor as empty dictionary."""
        probe = TelemetryProbe(metric_info_with_empty_dict)

        assert probe.monitor_info["detect_changes"] is False

    def test_initialization_with_none(self, metric_info_with_none):
        """Test probe initialization with monitor as None."""
        probe = TelemetryProbe(metric_info_with_none)

        assert probe.monitor_info["detect_changes"] is False


class TestTelemetryProbeMonitorInfoSetter:
    def test_monitor_info_dict_with_detect_changes(self, base_metric_info):
        """Test that dict monitor info sets detect_changes to True."""
        base_metric_info["data"]["monitor"] = {
            "alert": True,
            "bugzilla_notification_emails": ["test@test.com"],
        }
        probe = TelemetryProbe(base_metric_info)

        assert probe.monitor_info["detect_changes"] is True
        assert probe.monitor_info["alert"] is True

    def test_monitor_info_invalid_type_raises_error(self, base_metric_info):
        """Test that invalid monitor type raises validation error."""
        base_metric_info["data"]["monitor"] = "invalid_string"

        with pytest.raises(TelemetryProbeValidationError) as exc_info:
            TelemetryProbe(base_metric_info)

        assert "must by either a boolean or dictionary" in str(exc_info.value)
        assert "networking_http_channel_page_open_to_first_sent" in str(exc_info.value)


class TestTelemetryProbeChangeDetection:
    def test_get_change_detection_technique_default(self, metric_info_with_bool_true):
        """Test default change detection technique."""
        probe = TelemetryProbe(metric_info_with_bool_true)

        assert probe.get_change_detection_technique() == DEFAULT_CHANGE_DETECTION

    def test_get_change_detection_technique_custom(self, base_metric_info):
        """Test custom change detection technique."""
        base_metric_info["data"]["monitor"] = {
            "alert": True,
            "bugzilla_notification_emails": ["test@test.com"],
            "change-detection-technique": "custom_technique",
        }
        probe = TelemetryProbe(base_metric_info)

        assert probe.get_change_detection_technique() == "custom_technique"

    def test_should_detect_changes_true(self, metric_info_with_alert):
        """Test should_detect_changes returns True when enabled."""
        probe = TelemetryProbe(metric_info_with_alert)

        assert probe.should_detect_changes() is True

    def test_should_detect_changes_false(self, metric_info_with_bool_false):
        """Test should_detect_changes returns False when disabled."""
        probe = TelemetryProbe(metric_info_with_bool_false)

        assert probe.should_detect_changes() is False


class TestTelemetryProbeBugAndEmailDecisions:
    def test_should_file_bug_true(self, metric_info_with_alert):
        """Test should_file_bug returns True when alert=True."""
        probe = TelemetryProbe(metric_info_with_alert)

        assert probe.should_file_bug() is True

    def test_should_file_bug_false(self, metric_info_with_monitor_only):
        """Test should_file_bug returns False when alert=False."""
        probe = TelemetryProbe(metric_info_with_monitor_only)

        assert probe.should_file_bug() is False

    def test_should_file_bug_false_when_alert_not_present(self, metric_info_with_bool_true):
        """Test should_file_bug returns False when alert field not present."""
        probe = TelemetryProbe(metric_info_with_bool_true)

        assert probe.should_file_bug() is False

    def test_should_email_false_when_alert_true(self, metric_info_with_alert):
        """Test should_email returns False when alert=True."""
        probe = TelemetryProbe(metric_info_with_alert)

        assert probe.should_email() is False

    def test_should_email_true_when_alert_false(self, metric_info_with_monitor_only):
        """Test should_email returns True when alert=False."""
        probe = TelemetryProbe(metric_info_with_monitor_only)

        assert probe.should_email() is True

    def test_should_email_true_when_alert_not_present(self, metric_info_with_bool_true):
        """Test should_email returns True when alert field not present."""
        probe = TelemetryProbe(metric_info_with_bool_true)

        assert probe.should_email() is True


class TestTelemetryProbeNotificationEmails:
    def test_get_notification_emails_from_bugzilla_field(self, metric_info_with_alert):
        """Test getting notification emails from bugzilla_notification_emails."""
        probe = TelemetryProbe(metric_info_with_alert)

        emails = probe.get_notification_emails()
        assert emails == ["email@fake.fake.com"]

    def test_get_notification_emails_from_metric_info(self, base_metric_info):
        """Test getting notification emails from metric_info notification_emails."""
        base_metric_info["notification_emails"] = ["metric@test.com"]
        base_metric_info["data"]["monitor"] = {"notification_emails": ["metric@test.com"]}

        probe = TelemetryProbe(base_metric_info)
        emails = probe.get_notification_emails()

        assert emails == ["metric@test.com"]

    @pytest.mark.parametrize(
        "mock_response_data,expected_emails",
        [
            ({"notification_emails": ["api@mozilla.com"]}, ["api@mozilla.com"]),
            (
                {"notification_emails": ["user1@mozilla.com", "user2@mozilla.com"]},
                ["user1@mozilla.com", "user2@mozilla.com"],
            ),
        ],
    )
    def test_get_notification_emails_from_network_request(
        self, metric_info_with_bool_true, mock_response_data, expected_emails
    ):
        """Test notification emails retrieved from network request."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.probe.requests.get"
        ) as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = mock_response_data
            mock_response.raise_for_status = Mock()
            mock_get.return_value = mock_response

            probe = TelemetryProbe(metric_info_with_bool_true)
            emails = probe.get_notification_emails()

            # Verify the mock was called
            mock_get.assert_called_once()
            assert emails == expected_emails

    def test_get_notification_emails_network_request_failure(self, metric_info_with_bool_true):
        """Test default notification email when network request fails."""
        probe = TelemetryProbe(metric_info_with_bool_true)

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.probe.requests.get"
        ) as mock_get:
            mock_get.side_effect = Exception("Network error")

            emails = probe.get_notification_emails()
            assert emails == ["gmierzwinski@mozilla.com"]

    def test_get_notification_emails_custom_default(self, metric_info_with_bool_true):
        """Test custom default notification email when network request fails."""
        probe = TelemetryProbe(metric_info_with_bool_true)

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.probe.requests.get"
        ) as mock_get:
            mock_get.side_effect = Exception("Network error")

            emails = probe.get_notification_emails(default="custom@default.com")
            assert emails == ["custom@default.com"]


class TestTelemetryProbeValidation:
    def test_verify_probe_definition_with_alert_true_and_emails(self, metric_info_with_alert):
        """Test validation passes with alert=True and bugzilla_notification_emails."""
        probe = TelemetryProbe(metric_info_with_alert)
        # Should not raise
        probe.verify_probe_definition()

    def test_verify_probe_definition_alert_true_missing_emails_raises_error(self, base_metric_info):
        """Test validation fails with alert=True but missing bugzilla_notification_emails."""
        base_metric_info["data"]["monitor"] = {"alert": True}

        with pytest.raises(TelemetryProbeValidationError) as exc_info:
            TelemetryProbe(base_metric_info)

        assert "bugzilla_notification_emails" in str(exc_info.value)
        assert "must be set to valid Bugzilla account emails" in str(exc_info.value)

    def test_verify_probe_definition_monitor_only(self, metric_info_with_monitor_only):
        """Test validation passes with alert=False."""
        probe = TelemetryProbe(metric_info_with_monitor_only)
        # Should not raise
        probe.verify_probe_definition()

    def test_verify_probe_definition_monitor_without_bugzilla_emails(self, base_metric_info):
        """Test validation for monitor-only probe without bugzilla_notification_emails."""
        base_metric_info["data"]["monitor"] = {"alert": False}
        # _verify_monitor_probe returns early, so this should not raise
        probe = TelemetryProbe(base_metric_info)
        probe.verify_probe_definition()


class TestTelemetryProbeValidationError:
    def test_validation_error_message_format(self):
        """Test validation error message formatting."""
        error = TelemetryProbeValidationError("test_probe", "Something went wrong")

        assert "Probe test_probe: Something went wrong" == str(error)
