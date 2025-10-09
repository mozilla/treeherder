from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier import (
    TelemetryAlertModifier,
)
from treeherder.perf.models import PerformanceTelemetryAlert


class TestTelemetryAlertModifier:
    def test_add_updater(self):
        """Test adding an updater to the updaters list."""
        initial_count = len(TelemetryAlertModifier.get_updaters())

        class DummyUpdater:
            pass

        TelemetryAlertModifier.add(DummyUpdater)

        assert len(TelemetryAlertModifier.get_updaters()) == initial_count + 1
        assert DummyUpdater in TelemetryAlertModifier.get_updaters()

        # Clean up
        TelemetryAlertModifier.updaters.remove(DummyUpdater)

    def test_get_updaters(self):
        """Test getting the list of updaters."""
        updaters = TelemetryAlertModifier.get_updaters()
        assert isinstance(updaters, list)
        # ResolutionModifier should be registered (check by class name since decorator makes it None)
        assert any(u.__name__ == "ResolutionModifier" for u in updaters)

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_get_alert_updates_empty(self, mock_bug_searcher_class):
        """Test get_alert_updates when updaters return no updates."""
        # Mock BugSearcher to return no bugs
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": []}
        mock_bug_searcher_class.return_value = mock_searcher

        alerts = []
        updates = TelemetryAlertModifier.get_alert_updates(alerts)

        assert updates == {}

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_get_alert_updates_with_data(self, mock_bug_searcher_class, test_telemetry_alert):
        """Test get_alert_updates with actual updates from updaters."""
        # Mock BugSearcher to return bugs with resolutions
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": [{"id": 12345, "resolution": "FIXED"}]}
        mock_bug_searcher_class.return_value = mock_searcher

        # Update the alert with a bug number
        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        alerts = [test_telemetry_alert]
        updates = TelemetryAlertModifier.get_alert_updates(alerts)

        assert str(test_telemetry_alert.id) in updates
        assert "status" in updates[str(test_telemetry_alert.id)]
        assert updates[str(test_telemetry_alert.id)]["status"] == PerformanceTelemetryAlert.FIXED

    @patch(
        "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.MODIFIABLE_ALERT_FIELDS",
        ("status", "test_field"),
    )
    def test_get_alert_updates_with_two_modifiers_different_fields(self, test_telemetry_alert):
        """Test get_alert_updates with two modifiers updating different fields for the same alert."""

        class StatusModifier:
            @staticmethod
            def update_alerts(**kwargs):
                return {str(test_telemetry_alert.id): {"status": 1}}

        class TestFieldModifier:
            @staticmethod
            def update_alerts(**kwargs):
                return {str(test_telemetry_alert.id): {"test_field": "test_value"}}

        # Save original updaters
        original_updaters = TelemetryAlertModifier.updaters.copy()

        # Replace with our test updaters
        TelemetryAlertModifier.updaters = [StatusModifier, TestFieldModifier]

        try:
            updates = TelemetryAlertModifier.get_alert_updates([test_telemetry_alert])

            # Both modifiers should contribute their updates
            assert str(test_telemetry_alert.id) in updates
            assert updates[str(test_telemetry_alert.id)]["status"] == 1
            assert updates[str(test_telemetry_alert.id)]["test_field"] == "test_value"
        finally:
            # Restore original updaters
            TelemetryAlertModifier.updaters = original_updaters

    def test_get_alert_updates_with_two_modifiers_same_field(self, test_telemetry_alert, caplog):
        """Test get_alert_updates with two modifiers trying to update the same field."""

        class FirstStatusModifier:
            @staticmethod
            def update_alerts(**kwargs):
                return {str(test_telemetry_alert.id): {"status": 1}}

        class SecondStatusModifier:
            @staticmethod
            def update_alerts(**kwargs):
                return {str(test_telemetry_alert.id): {"status": 2}}

        # Save original updaters
        original_updaters = TelemetryAlertModifier.updaters.copy()

        # Replace with our test updaters
        TelemetryAlertModifier.updaters = [FirstStatusModifier, SecondStatusModifier]

        try:
            updates = TelemetryAlertModifier.get_alert_updates([test_telemetry_alert])

            # First modifier's value should win, second should be logged as warning
            assert str(test_telemetry_alert.id) in updates
            assert updates[str(test_telemetry_alert.id)]["status"] == 1
            assert (
                f"Multiple modifications found for alert ID {test_telemetry_alert.id}"
                in caplog.text
            )
            assert "status" in caplog.text
        finally:
            # Restore original updaters
            TelemetryAlertModifier.updaters = original_updaters

    def test_merge_updates_single_updater(self):
        """Test merging updates from a single updater."""
        all_updates = {"1": [{"status": 1}], "2": [{"status": 2}]}

        merged = TelemetryAlertModifier._merge_updates(all_updates)

        assert merged == {"1": {"status": 1}, "2": {"status": 2}}

    def test_merge_updates_multiple_updaters_no_conflict(self):
        """Test merging updates from multiple updaters with no conflicts."""
        all_updates = {
            "1": [{"status": 1}],
            "2": [{"status": 2}],
        }

        merged = TelemetryAlertModifier._merge_updates(all_updates)

        assert merged == {"1": {"status": 1}, "2": {"status": 2}}

    def test_merge_updates_with_field_conflict(self, caplog):
        """Test merging updates when multiple updaters try to modify the same field."""
        all_updates = {"1": [{"status": 1}, {"status": 2}]}

        merged = TelemetryAlertModifier._merge_updates(all_updates)

        # First update should be kept, second should be ignored with warning
        assert merged == {"1": {"status": 1}}
        assert "Multiple modifications found for alert ID 1" in caplog.text

    def test_merge_updates_with_invalid_field(self, caplog):
        """Test merging updates with a non-modifiable field."""
        all_updates = {"1": [{"invalid_field": "value"}]}

        merged = TelemetryAlertModifier._merge_updates(all_updates)

        # Update should be ignored with warning
        assert merged == {"1": {}}
        assert "Model field invalid_field is not set as a modifiable field" in caplog.text

    def test_merge_updates_mixed_valid_invalid_fields(self, caplog):
        """Test merging updates with both valid and invalid fields."""
        all_updates = {"1": [{"status": 1, "invalid_field": "value"}]}

        merged = TelemetryAlertModifier._merge_updates(all_updates)

        # Only valid field should be kept
        assert merged == {"1": {"status": 1}}
        assert "Model field invalid_field is not set as a modifiable field" in caplog.text

    def test_merge_updates_empty(self):
        """Test merging with no updates."""
        all_updates = {}

        merged = TelemetryAlertModifier._merge_updates(all_updates)

        assert merged == {}


class TestResolutionModifier:
    @pytest.fixture
    def resolution_modifier_class(self):
        """Get the ResolutionModifier class from the updaters list."""
        # Find ResolutionModifier in the updaters list since the decorator makes it None
        for updater in TelemetryAlertModifier.get_updaters():
            if updater.__name__ == "ResolutionModifier":
                return updater
        pytest.fail("ResolutionModifier not found in updaters list")

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_no_bugs(self, mock_bug_searcher_class, resolution_modifier_class):
        """Test update_alerts when no bugs are found."""
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": []}
        mock_bug_searcher_class.return_value = mock_searcher

        updates = resolution_modifier_class.update_alerts()

        assert updates == {}

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_with_fixed_bug(
        self, mock_bug_searcher_class, resolution_modifier_class, test_telemetry_alert
    ):
        """Test update_alerts when bugs have FIXED resolution."""
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": [{"id": 12345, "resolution": "FIXED"}]}
        mock_bug_searcher_class.return_value = mock_searcher

        # Set bug number on alert
        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        updates = resolution_modifier_class.update_alerts()

        assert str(test_telemetry_alert.id) in updates
        assert updates[str(test_telemetry_alert.id)]["status"] == PerformanceTelemetryAlert.FIXED

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_with_multiple_bugs(
        self,
        mock_bug_searcher_class,
        resolution_modifier_class,
        test_telemetry_alert,
        create_telemetry_signature,
        create_telemetry_alert,
    ):
        """Test update_alerts with multiple bugs and alerts."""
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [
                {"id": 12345, "resolution": "FIXED"},
                {"id": 67890, "resolution": "INVALID"},
            ]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        # Create another alert with a different bug
        sig2 = create_telemetry_signature(probe="test_probe2")
        alert2 = create_telemetry_alert(sig2, bug_number=67890)

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        updates = resolution_modifier_class.update_alerts()

        assert str(test_telemetry_alert.id) in updates
        assert str(alert2.id) in updates
        assert updates[str(test_telemetry_alert.id)]["status"] == PerformanceTelemetryAlert.FIXED
        assert updates[str(alert2.id)]["status"] == PerformanceTelemetryAlert.INVALID

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_bug_not_matching_alert(
        self, mock_bug_searcher_class, resolution_modifier_class, test_telemetry_alert
    ):
        """Test update_alerts when bugs don't match any alerts."""
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": [{"id": 99999, "resolution": "FIXED"}]}
        mock_bug_searcher_class.return_value = mock_searcher

        # Alert has a different bug number
        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        updates = resolution_modifier_class.update_alerts()

        assert updates == {}

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_unknown_resolution(
        self, mock_bug_searcher_class, resolution_modifier_class, test_telemetry_alert
    ):
        """Test update_alerts when bug has an unknown resolution."""
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": [{"id": 12345, "resolution": "UNKNOWN"}]}
        mock_bug_searcher_class.return_value = mock_searcher

        test_telemetry_alert.bug_number = 12345
        test_telemetry_alert.save()

        updates = resolution_modifier_class.update_alerts()

        # Should not update if resolution is not recognized
        assert updates == {}

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_exception_handling(
        self, mock_bug_searcher_class, resolution_modifier_class, caplog
    ):
        """Test update_alerts handles exceptions gracefully."""
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.side_effect = Exception("API Error")
        mock_bug_searcher_class.return_value = mock_searcher

        updates = resolution_modifier_class.update_alerts()

        assert updates is None
        assert "Failed to get bugs for alert resolution updates" in caplog.text
        assert "API Error" in caplog.text

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_sets_correct_query(
        self, mock_bug_searcher_class, resolution_modifier_class
    ):
        """Test that update_alerts sets the correct bugzilla query."""
        mock_searcher = Mock()
        today = datetime.now().date()
        mock_searcher.get_today_date.return_value = today
        mock_searcher.get_bugs.return_value = {"bugs": []}
        mock_bug_searcher_class.return_value = mock_searcher

        resolution_modifier_class.update_alerts()

        # Verify set_include_fields was called
        mock_searcher.set_include_fields.assert_called_once_with(["id", "resolution"])

        # Verify set_query was called with correct parameters
        expected_start_date = today - timedelta(7)
        call_args = mock_searcher.set_query.call_args[0][0]

        assert call_args["f1"] == "keywords"
        assert call_args["o1"] == "anywords"
        assert call_args["v1"] == "telemetry-alert"
        assert call_args["f2"] == "resolution"
        assert call_args["f4"] == "resolution"
        assert call_args["o4"] == "changedafter"
        assert call_args["v4"] == expected_start_date
