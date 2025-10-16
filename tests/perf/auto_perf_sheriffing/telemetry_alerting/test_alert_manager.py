import logging
from unittest.mock import Mock, patch

import pytest

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
    TelemetryAlertFactory,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager import (
    TelemetryAlertManager,
)
from treeherder.perf.models import PerformanceTelemetryAlert


@pytest.fixture
def mock_probes_dict(mock_probe):
    """Mock probes dictionary."""
    probes = {"test_probe": mock_probe}

    # Add indexed probes for tests that need them
    for i in range(10):
        probe = Mock()
        probe.name = f"test_probe_{i}"
        probe.should_file_bug.return_value = True
        probe.should_email.return_value = False
        probes[f"test_probe_{i}"] = probe

    return probes


@pytest.fixture
def mock_bug_manager():
    """Mock TelemetryBugManager."""
    manager = Mock()
    manager.file_bug.return_value = {"id": 123456}
    manager.modify_bug.return_value = None
    return manager


@pytest.fixture
def mock_email_manager():
    """Mock TelemetryEmailManager."""
    manager = Mock()
    manager.email_alert.return_value = None
    return manager


@pytest.fixture
def telemetry_alert_manager(mock_probes_dict):
    """TelemetryAlertManager instance with mocked dependencies."""
    with (
        patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryBugManager"
        ) as mock_bug_mgr,
        patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryEmailManager"
        ) as mock_email_mgr,
    ):
        mock_bug_mgr.return_value = Mock()
        mock_email_mgr.return_value = Mock()
        manager = TelemetryAlertManager(mock_probes_dict)
        return manager


@pytest.fixture
def telemetry_alert_with_probe(telemetry_alert_obj, test_telemetry_signature):
    """TelemetryAlert object with a probe set."""
    return telemetry_alert_obj


class TestTelemetryAlertManager:
    def test_initialization(self, mock_probes_dict):
        """Test TelemetryAlertManager initialization."""
        with (
            patch(
                "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryBugManager"
            ) as mock_bug_mgr,
            patch(
                "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryEmailManager"
            ) as mock_email_mgr,
        ):
            mock_bug_mgr.return_value = Mock()
            mock_email_mgr.return_value = Mock()

            manager = TelemetryAlertManager(mock_probes_dict)

            assert manager.probes == mock_probes_dict
            assert manager.bug_manager is not None
            assert manager.email_manager is not None

    def test_get_probe_info_success(self, telemetry_alert_manager, mock_probe):
        """Test getting probe info for a known probe."""
        probe = telemetry_alert_manager._get_probe_info("test_probe")
        assert probe == mock_probe

    def test_get_probe_info_unknown_probe(self, telemetry_alert_manager):
        """Test getting probe info for an unknown probe raises exception."""
        with pytest.raises(Exception) as exc_info:
            telemetry_alert_manager._get_probe_info("unknown_probe")

        assert "Unknown probe alerted" in str(exc_info.value)
        assert "unknown_probe" in str(exc_info.value)

    def test_comment_alert_bugs_does_nothing(self, telemetry_alert_manager, alert_without_bug):
        """Test comment_alert_bugs does nothing (pass statement)."""
        result = telemetry_alert_manager.comment_alert_bugs([alert_without_bug])
        assert result is None

    def test_update_alerts_no_updates(self, telemetry_alert_manager, alert_without_bug):
        """Test update_alerts when there are no updates."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {}

            telemetry_alert_manager.update_alerts([alert_without_bug])

            mock_modifier.get_alert_updates.assert_called_once()

    def test_update_alerts_with_updates(self, telemetry_alert_manager, alert_without_bug, caplog):
        """Test update_alerts when there are updates to apply."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {
                str(alert_without_bug.telemetry_alert.id): {"status": 1}
            }

            with caplog.at_level(logging.INFO):
                telemetry_alert_manager.update_alerts([alert_without_bug])

            # Verify the alert was updated
            alert_without_bug.telemetry_alert.refresh_from_db()
            assert alert_without_bug.telemetry_alert.status == 1

            # Verify logging
            assert "Updating the following alert IDs" in caplog.text
            assert str(alert_without_bug.telemetry_alert.id) in caplog.text
            assert "alerts updated with changes" in caplog.text

    def test_update_alerts_ignores_non_modifiable_fields(
        self, telemetry_alert_manager, alert_without_bug, caplog
    ):
        """Test update_alerts ignores fields not in MODIFIABLE_ALERT_FIELDS."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {
                str(alert_without_bug.telemetry_alert.id): {
                    "status": 1,
                    "bug_number": 999999,  # Not in MODIFIABLE_ALERT_FIELDS
                }
            }

            telemetry_alert_manager.update_alerts([alert_without_bug])

            # Only status should be updated
            alert_without_bug.telemetry_alert.refresh_from_db()
            assert alert_without_bug.telemetry_alert.status == 1
            assert alert_without_bug.telemetry_alert.bug_number is None

    def test_modify_alert_bugs_disabled(self, telemetry_alert_manager, alert_without_bug):
        """Test modify_alert_bugs returns early (currently disabled)."""
        result = telemetry_alert_manager.modify_alert_bugs([alert_without_bug], [], [])
        assert result is None

    def test_should_file_bug_with_probe_that_should_file(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test __should_file_bug returns True when conditions are met."""
        mock_probe.should_file_bug.return_value = True
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.failed = False

        result = telemetry_alert_manager._TelemetryAlertManager__should_file_bug(
            mock_probe, alert_without_bug
        )

        assert result is True

    def test_should_file_bug_with_existing_bug(
        self, telemetry_alert_manager, alert_with_bug, mock_probe
    ):
        """Test __should_file_bug returns False when bug already exists."""
        mock_probe.should_file_bug.return_value = True
        alert_with_bug.failed = False

        result = telemetry_alert_manager._TelemetryAlertManager__should_file_bug(
            mock_probe, alert_with_bug
        )

        assert result is False

    def test_should_file_bug_with_failed_alert(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test __should_file_bug returns False when alert has failed."""
        mock_probe.should_file_bug.return_value = True
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.failed = True

        result = telemetry_alert_manager._TelemetryAlertManager__should_file_bug(
            mock_probe, alert_without_bug
        )

        assert result is False

    def test_should_file_bug_probe_should_not_file(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test __should_file_bug returns False when probe should not file bug."""
        mock_probe.should_file_bug.return_value = False
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.failed = False

        result = telemetry_alert_manager._TelemetryAlertManager__should_file_bug(
            mock_probe, alert_without_bug
        )

        assert result is False

    def test_file_alert_bug_success(self, telemetry_alert_manager, alert_without_bug, mock_probe):
        """Test _file_alert_bug successfully files a bug."""
        mock_probe.should_file_bug.return_value = True
        telemetry_alert_manager.bug_manager.file_bug.return_value = {"id": 123456}
        alert_without_bug.telemetry_signature.probe = "test_probe"

        bug_id = telemetry_alert_manager._file_alert_bug(alert_without_bug)

        assert bug_id == 123456
        alert_without_bug.telemetry_alert.refresh_from_db()
        assert alert_without_bug.telemetry_alert.bug_number == 123456
        telemetry_alert_manager.bug_manager.file_bug.assert_called_once()

    def test_file_alert_bug_when_should_not_file(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test _file_alert_bug returns None when should not file bug."""
        mock_probe.should_file_bug.return_value = False
        alert_without_bug.telemetry_signature.probe = "test_probe"

        bug_id = telemetry_alert_manager._file_alert_bug(alert_without_bug)

        assert bug_id is None
        telemetry_alert_manager.bug_manager.file_bug.assert_not_called()

    def test_file_alert_bug_failure_deletes_alert(
        self, telemetry_alert_manager, alert_without_bug, mock_probe, caplog
    ):
        """Test _file_alert_bug deletes alert on failure."""
        mock_probe.should_file_bug.return_value = True
        telemetry_alert_manager.bug_manager.file_bug.side_effect = Exception("Bugzilla API error")
        alert_without_bug.telemetry_signature.probe = "test_probe"
        alert_id = alert_without_bug.telemetry_alert.id

        with caplog.at_level(logging.WARNING):
            bug_id = telemetry_alert_manager._file_alert_bug(alert_without_bug)

        assert bug_id is None
        assert alert_without_bug.failed is True
        assert "Failed to create alert bug" in caplog.text

        # Verify the alert was deleted
        assert not PerformanceTelemetryAlert.objects.filter(id=alert_id).exists()

    def test_should_notify_with_probe_that_should_email(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test __should_notify returns True when conditions are met."""
        mock_probe.should_email.return_value = True
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.failed = False

        result = telemetry_alert_manager._TelemetryAlertManager__should_notify(
            mock_probe, alert_without_bug
        )

        assert result is True

    def test_should_notify_with_existing_bug(
        self, telemetry_alert_manager, alert_with_bug, mock_probe
    ):
        """Test __should_notify returns False when bug already exists."""
        mock_probe.should_email.return_value = True
        alert_with_bug.failed = False

        result = telemetry_alert_manager._TelemetryAlertManager__should_notify(
            mock_probe, alert_with_bug
        )

        assert result is False

    def test_should_notify_with_failed_alert(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test __should_notify returns False when alert has failed."""
        mock_probe.should_email.return_value = True
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.failed = True

        result = telemetry_alert_manager._TelemetryAlertManager__should_notify(
            mock_probe, alert_without_bug
        )

        assert result is False

    def test_should_notify_probe_should_not_email(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test __should_notify returns False when probe should not email."""
        mock_probe.should_email.return_value = False
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.failed = False

        result = telemetry_alert_manager._TelemetryAlertManager__should_notify(
            mock_probe, alert_without_bug
        )

        assert result is False

    def test_email_alert_success(self, telemetry_alert_manager, alert_without_bug, mock_probe):
        """Test _email_alert successfully sends an email."""
        mock_probe.should_email.return_value = True
        alert_without_bug.telemetry_signature.probe = "test_probe"

        telemetry_alert_manager._email_alert(alert_without_bug)

        alert_without_bug.telemetry_alert.refresh_from_db()
        assert alert_without_bug.telemetry_alert.notified is True
        telemetry_alert_manager.email_manager.email_alert.assert_called_once()

    def test_email_alert_when_should_not_notify(
        self, telemetry_alert_manager, alert_without_bug, mock_probe
    ):
        """Test _email_alert returns early when should not notify."""
        mock_probe.should_email.return_value = False
        alert_without_bug.telemetry_signature.probe = "test_probe"

        telemetry_alert_manager._email_alert(alert_without_bug)

        telemetry_alert_manager.email_manager.email_alert.assert_not_called()

    def test_email_alert_failure_sets_notified_false(
        self, telemetry_alert_manager, alert_without_bug, mock_probe, caplog
    ):
        """Test _email_alert sets notified=False on failure."""
        mock_probe.should_email.return_value = True
        telemetry_alert_manager.email_manager.email_alert.side_effect = Exception(
            "Email sending error"
        )
        alert_without_bug.telemetry_signature.probe = "test_probe"

        with caplog.at_level(logging.WARNING):
            telemetry_alert_manager._email_alert(alert_without_bug)

        alert_without_bug.telemetry_alert.refresh_from_db()
        assert alert_without_bug.telemetry_alert.notified is False
        assert "Failed to create alert email" in caplog.text

    def test_redo_email_alerts(
        self, test_telemetry_alert, telemetry_alert_manager, mock_probe, caplog
    ):
        """Test _redo_email_alerts retries failed email alerts."""
        mock_probe.should_email.return_value = True

        with caplog.at_level(logging.INFO):
            telemetry_alert_manager._redo_email_alerts()

        assert "House keeping: retrying emails for alerts" in caplog.text
        # The email_manager.email_alert should be called for the retry
        telemetry_alert_manager.email_manager.email_alert.assert_called()

    def test_redo_email_alerts_skips_with_bug_number(self, telemetry_alert_manager, alert_with_bug):
        """Test _redo_email_alerts skips alerts with bug numbers."""
        alert_with_bug.telemetry_alert.notified = False
        alert_with_bug.telemetry_alert.save()

        telemetry_alert_manager._redo_email_alerts()

        # Should not be called because alert has a bug number
        telemetry_alert_manager.email_manager.email_alert.assert_not_called()

    def test_redo_email_alerts_skips_already_notified(
        self, telemetry_alert_manager, alert_without_bug
    ):
        """Test _redo_email_alerts skips alerts already notified."""
        alert_without_bug.telemetry_alert.notified = True
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.telemetry_alert.save()

        telemetry_alert_manager._redo_email_alerts()

        # Should not be called because alert is already notified
        telemetry_alert_manager.email_manager.email_alert.assert_not_called()

    def test_redo_bug_modifications(
        self, telemetry_alert_manager, test_telemetry_alert_summary, caplog
    ):
        """Test _redo_bug_modifications retries failed bug modifications."""
        test_telemetry_alert_summary.bugs_modified = False
        test_telemetry_alert_summary.save()

        with caplog.at_level(logging.INFO):
            telemetry_alert_manager._redo_bug_modifications()

        assert "House keeping: retrying bug modifications" in caplog.text

    def test_redo_bug_modifications_no_unmodified_summaries(
        self, telemetry_alert_manager, test_telemetry_alert_summary, caplog
    ):
        """Test _redo_bug_modifications when all summaries are modified."""
        test_telemetry_alert_summary.bugs_modified = True
        test_telemetry_alert_summary.save()

        with caplog.at_level(logging.INFO):
            telemetry_alert_manager._redo_bug_modifications()

        assert "House keeping: retrying bug modifications" in caplog.text

    def test_redo_bug_modifications_with_alerts(
        self, telemetry_alert_manager, test_telemetry_alert_summary, alert_without_bug, caplog
    ):
        """Test _redo_bug_modifications reconstructs alerts from unmodified summaries."""
        test_telemetry_alert_summary.bugs_modified = False
        test_telemetry_alert_summary.save()

        with caplog.at_level(logging.INFO):
            telemetry_alert_manager._redo_bug_modifications()

        assert "House keeping: retrying bug modifications" in caplog.text
        # This test ensures line 244 is covered (alert construction in loop)

    def test_house_keeping_calls_all_methods(
        self, telemetry_alert_manager, alert_without_bug, caplog
    ):
        """Test house_keeping calls both _redo_email_alerts and _redo_bug_modifications."""
        alert_without_bug.telemetry_alert.notified = False
        alert_without_bug.telemetry_alert.bug_number = None
        alert_without_bug.telemetry_alert.save()

        with caplog.at_level(logging.INFO):
            telemetry_alert_manager.house_keeping([alert_without_bug], [], [])

        assert "Performing house keeping" in caplog.text
        assert "House keeping: retrying emails for alerts" in caplog.text
        assert "House keeping: retrying bug modifications" in caplog.text

    def test_multiple_alerts_bulk_update(
        self,
        create_telemetry_signature,
        create_telemetry_alert,
        telemetry_alert_manager,
        test_telemetry_alert_summary,
    ):
        """Test update_alerts performs bulk updates for multiple alerts."""

        # Create multiple alerts with different signatures to avoid unique constraint
        alerts = []
        for i in range(3):
            signature = create_telemetry_signature(probe=f"test_probe_{i}")
            alert_row = create_telemetry_alert(signature)
            alerts.append(TelemetryAlertFactory.construct_alert(alert_row))

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {
                str(alerts[0].telemetry_alert.id): {"status": 1},
                str(alerts[1].telemetry_alert.id): {"status": 2},
                str(alerts[2].telemetry_alert.id): {"status": 1},
            }

            telemetry_alert_manager.update_alerts(alerts)

            # Verify all alerts were updated
            for i, alert in enumerate(alerts):
                alert.telemetry_alert.refresh_from_db()
                expected_status = 1 if i in [0, 2] else 2
                assert alert.telemetry_alert.status == expected_status

    def test_manage_alerts_full_workflow(
        self, test_telemetry_alert, telemetry_alert_manager, mock_probe
    ):
        """Test manage_alerts runs the full workflow successfully."""

        # Create test alerts
        alert = TelemetryAlertFactory.construct_alert(test_telemetry_alert)

        # Configure mocks
        mock_probe.should_file_bug.return_value = True
        mock_probe.should_email.return_value = False
        telemetry_alert_manager.bug_manager.file_bug.return_value = {"id": 999888}

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {}

            # Run the full manage_alerts workflow
            telemetry_alert_manager.manage_alerts([alert])

            # Verify all steps were executed
            mock_modifier.get_alert_updates.assert_called_once()
            telemetry_alert_manager.bug_manager.file_bug.assert_called_once()

            # Verify the bug was filed
            test_telemetry_alert.refresh_from_db()
            assert test_telemetry_alert.bug_number == 999888

    def test_manage_alerts_continues_after_update_failure(
        self, telemetry_alert_manager, alert_without_bug, mock_probe, caplog
    ):
        """Test manage_alerts continues after update_alerts fails."""
        mock_probe.should_file_bug.return_value = True
        alert_without_bug.telemetry_signature.probe = "test_probe"

        telemetry_alert_manager.bug_manager.file_bug.return_value = {"id": 111222}

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.side_effect = Exception("Update error")

            with caplog.at_level(logging.INFO):
                telemetry_alert_manager.manage_alerts([alert_without_bug])

            # Verify update failed but filing still happened
            assert "Failed to update alerts" in caplog.text
            telemetry_alert_manager.bug_manager.file_bug.assert_called_once()

            # Bug should still be filed
            alert_without_bug.telemetry_alert.refresh_from_db()
            assert alert_without_bug.telemetry_alert.bug_number == 111222

    def test_manage_alerts_continues_after_file_bug_failure(
        self, telemetry_alert_manager, alert_without_bug, mock_probe, caplog
    ):
        """Test manage_alerts continues after _file_alert_bug fails."""
        mock_probe.should_file_bug.return_value = True
        mock_probe.should_email.return_value = False
        alert_without_bug.telemetry_signature.probe = "test_probe"

        # Make file_bug fail
        telemetry_alert_manager.bug_manager.file_bug.side_effect = Exception("Bugzilla error")

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {}

            with caplog.at_level(logging.INFO):
                telemetry_alert_manager.manage_alerts([alert_without_bug])

            # Verify bug filing failed but housekeeping still ran
            assert "Failed to create alert bug" in caplog.text
            assert "Performing house keeping" in caplog.text

    def test_manage_alerts_continues_after_email_failure(
        self, telemetry_alert_manager, alert_without_bug, mock_probe, caplog
    ):
        """Test manage_alerts continues after _email_alert fails."""
        mock_probe.should_file_bug.return_value = False
        mock_probe.should_email.return_value = True
        alert_without_bug.telemetry_signature.probe = "test_probe"

        # Make email_alert fail
        telemetry_alert_manager.email_manager.email_alert.side_effect = Exception("Email error")

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {}

            with caplog.at_level(logging.INFO):  # Changed to INFO to capture house keeping log
                telemetry_alert_manager.manage_alerts([alert_without_bug])

            # Verify email failed but housekeeping still ran
            assert "Failed to create alert email" in caplog.text
            assert "Performing house keeping" in caplog.text

            # Verify notified was set to False
            alert_without_bug.telemetry_alert.refresh_from_db()
            assert alert_without_bug.telemetry_alert.notified is False

    def test_manage_alerts_filters_failed_alerts_before_modify(
        self, create_telemetry_signature, create_telemetry_alert, telemetry_alert_manager
    ):
        """Test manage_alerts filters out failed alerts before modify_alert_bugs."""

        # Create alerts (probes already exist in telemetry_alert_manager via fixture)
        alerts = []
        for i in range(3):
            signature = create_telemetry_signature(probe=f"test_probe_{i}")
            alert_row = create_telemetry_alert(signature)
            alerts.append(TelemetryAlertFactory.construct_alert(alert_row))

        # Mark some alerts as failed during bug filing
        def file_bug_side_effect(probe, alert):
            if alert == alerts[0] or alert == alerts[2]:
                raise Exception("Bug filing failed")
            return {"id": 999777}

        telemetry_alert_manager.bug_manager.file_bug.side_effect = file_bug_side_effect

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {}

            # Create a spy on modify_alert_bugs to verify which alerts are passed
            original_modify = telemetry_alert_manager.modify_alert_bugs
            modify_calls = []

            def modify_spy(alerts_arg, commented_bugs, new_bugs):
                modify_calls.append(alerts_arg)
                return original_modify(alerts_arg, commented_bugs, new_bugs)

            telemetry_alert_manager.modify_alert_bugs = modify_spy

            telemetry_alert_manager.manage_alerts(alerts)

            # Verify modify_alert_bugs was called (could be multiple times due to house_keeping)
            # Find the call with non-empty alerts
            non_empty_calls = [call for call in modify_calls if len(call) > 0]
            assert len(non_empty_calls) >= 1, (
                "modify_alert_bugs should be called with at least one non-empty alert list"
            )

            # Check the first non-empty call (the main manage_alerts call)
            passed_alerts = non_empty_calls[0]
            # Only the middle alert (index 1) should be passed (others failed)
            assert len(passed_alerts) == 1, f"Expected 1 alert, got {len(passed_alerts)}"
            assert passed_alerts[0] == alerts[1]

    def test_manage_alerts_with_mixed_bug_and_email_alerts(
        self,
        create_telemetry_signature,
        create_telemetry_alert,
        telemetry_alert_manager,
        test_telemetry_alert_summary,
    ):
        """Test manage_alerts with some alerts filing bugs and others sending emails."""

        # Create two probes with different configurations
        probe_with_bug = Mock()
        probe_with_bug.name = "probe_bug"
        probe_with_bug.should_file_bug.return_value = True
        probe_with_bug.should_email.return_value = False

        probe_with_email = Mock()
        probe_with_email.name = "probe_email"
        probe_with_email.should_file_bug.return_value = False
        probe_with_email.should_email.return_value = True

        # Update the manager's probes dictionary
        telemetry_alert_manager.probes = {
            "probe_bug": probe_with_bug,
            "probe_email": probe_with_email,
        }

        # Create alerts
        sig1 = create_telemetry_signature(probe="probe_bug")
        alert_row1 = create_telemetry_alert(sig1)
        alert1 = TelemetryAlertFactory.construct_alert(alert_row1)

        sig2 = create_telemetry_signature(probe="probe_email")
        alert_row2 = create_telemetry_alert(sig2)
        alert2 = TelemetryAlertFactory.construct_alert(alert_row2)

        telemetry_alert_manager.bug_manager.file_bug.return_value = {"id": 333444}

        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_manager.TelemetryAlertModifier"
        ) as mock_modifier:
            mock_modifier.get_alert_updates.return_value = {}

            telemetry_alert_manager.manage_alerts([alert1, alert2])

            # Verify bug was filed for alert1
            alert_row1.refresh_from_db()
            assert alert_row1.bug_number == 333444

            # Verify email was sent for alert2
            alert_row2.refresh_from_db()
            assert alert_row2.notified is True
            assert alert_row2.bug_number is None

            # Verify the correct methods were called
            telemetry_alert_manager.bug_manager.file_bug.assert_called_once()
            telemetry_alert_manager.email_manager.email_alert.assert_called_once()
