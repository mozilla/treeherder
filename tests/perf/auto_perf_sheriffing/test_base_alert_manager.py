import logging

import pytest

from treeherder.perf.auto_perf_sheriffing.base_alert_manager import Alert, AlertManager


class TestAlert:
    """Tests for the Alert base class."""

    def test_alert_initialization(self):
        """Test that Alert initializes with failed=False."""
        alert = Alert()
        assert alert.failed is False

    def test_alert_set_failed_true(self):
        """Test setting alert.failed to True."""
        alert = Alert()
        alert.failed = True
        assert alert.failed is True

    def test_alert_set_failed_false(self):
        """Test setting alert.failed to False."""
        alert = Alert()
        alert.failed = True
        alert.failed = False
        assert alert.failed is False

    def test_alert_failed_property(self):
        """Test that failed property getter and setter work correctly."""
        alert = Alert()
        assert alert.failed is False
        alert.failed = True
        assert alert.failed is True


class MockBugManager:
    """Mock implementation of BugManager for testing."""

    def __init__(self):
        self.file_bug_called = False
        self.modify_bug_called = False
        self.comment_bug_called = False


class MockEmailManager:
    """Mock implementation of EmailManager for testing."""

    def __init__(self):
        self.email_alert_called = False


class ConcreteAlertManager(AlertManager):
    """Concrete implementation of AlertManager for testing."""

    def __init__(self, bug_manager, email_manager):
        super().__init__(bug_manager, email_manager)
        self.update_alerts_called = False
        self.comment_alert_bugs_called = False
        self.file_alert_bug_called = False
        self.modify_alert_bugs_called = False
        self.email_alert_called = False
        self.house_keeping_called = False

    def update_alerts(self, *args, **kwargs):
        self.update_alerts_called = True

    def comment_alert_bugs(self, alerts, *args, **kwargs):
        self.comment_alert_bugs_called = True
        return [123, 456]

    def _file_alert_bug(self, alert, *args, **kwargs):
        self.file_alert_bug_called = True
        return 789

    def modify_alert_bugs(self, alerts, commented_bugs, new_bugs, *args, **kwargs):
        self.modify_alert_bugs_called = True

    def _email_alert(self, alert, *args, **kwargs):
        self.email_alert_called = True

    def house_keeping(self, alerts, commented_bugs, new_bugs, *args, **kwargs):
        self.house_keeping_called = True


@pytest.fixture
def mock_bug_manager():
    """Fixture providing a mock bug manager."""
    return MockBugManager()


@pytest.fixture
def mock_email_manager():
    """Fixture providing a mock email manager."""
    return MockEmailManager()


@pytest.fixture
def base_alert_manager(mock_bug_manager, mock_email_manager):
    """Fixture providing a base AlertManager instance."""
    return AlertManager(mock_bug_manager, mock_email_manager)


@pytest.fixture
def concrete_alert_manager(mock_bug_manager, mock_email_manager):
    """Fixture providing a concrete AlertManager instance."""
    return ConcreteAlertManager(mock_bug_manager, mock_email_manager)


class TestAlertManager:
    """Tests for the AlertManager base class."""

    def test_alert_manager_initialization(self, mock_bug_manager, mock_email_manager):
        """Test AlertManager initialization with bug and email managers."""
        manager = AlertManager(mock_bug_manager, mock_email_manager)

        assert manager.bug_manager is mock_bug_manager
        assert manager.email_manager is mock_email_manager

    def test_manage_alerts_calls_all_methods(self, concrete_alert_manager):
        """Test that manage_alerts calls all expected methods in order."""
        alerts = [Alert(), Alert()]
        concrete_alert_manager.manage_alerts(alerts)

        assert concrete_alert_manager.update_alerts_called
        assert concrete_alert_manager.comment_alert_bugs_called
        assert concrete_alert_manager.file_alert_bug_called
        assert concrete_alert_manager.modify_alert_bugs_called
        assert concrete_alert_manager.email_alert_called
        assert concrete_alert_manager.house_keeping_called

    def test_manage_alerts_continues_on_update_failure(
        self, mock_bug_manager, mock_email_manager, caplog
    ):
        """Test that manage_alerts continues after update_alerts fails."""

        class FailingUpdateManager(ConcreteAlertManager):
            def update_alerts(self, *args, **kwargs):
                self.update_alerts_called = True
                raise Exception("Update failed")

        manager = FailingUpdateManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert()]
        with caplog.at_level(logging.INFO):
            manager.manage_alerts(alerts)

        assert manager.update_alerts_called
        assert manager.comment_alert_bugs_called
        assert "Failed to update alerts" in caplog.text

    def test_manage_alerts_continues_on_comment_failure(
        self, mock_bug_manager, mock_email_manager, caplog
    ):
        """Test that manage_alerts continues after comment_alert_bugs fails."""

        class FailingCommentManager(ConcreteAlertManager):
            def comment_alert_bugs(self, *args, **kwargs):
                self.comment_alert_bugs_called = True
                raise Exception("Comment failed")

        manager = FailingCommentManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert()]
        with caplog.at_level(logging.WARNING):
            manager.manage_alerts(alerts)

        assert manager.comment_alert_bugs_called
        assert manager.file_alert_bug_called
        assert "Failed to comment on existing bugs" in caplog.text

    def test_manage_alerts_continues_on_file_bug_failure(
        self, mock_bug_manager, mock_email_manager, caplog
    ):
        """Test that manage_alerts continues after file_alert_bugs fails."""

        class FailingFileBugManager(ConcreteAlertManager):
            def _file_alert_bug(self, *args, **kwargs):
                self.file_alert_bug_called = True
                raise Exception("File bug failed")

        manager = FailingFileBugManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert()]
        with caplog.at_level(logging.WARNING):
            manager.manage_alerts(alerts)

        assert manager.file_alert_bug_called
        assert manager.modify_alert_bugs_called
        assert "Failed to file alert bugs" in caplog.text

    def test_manage_alerts_continues_on_modify_failure(
        self, mock_bug_manager, mock_email_manager, caplog
    ):
        """Test that manage_alerts continues after modify_alert_bugs fails."""

        class FailingModifyManager(ConcreteAlertManager):
            def modify_alert_bugs(self, *args, **kwargs):
                self.modify_alert_bugs_called = True
                raise Exception("Modify failed")

        manager = FailingModifyManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert()]
        with caplog.at_level(logging.WARNING):
            manager.manage_alerts(alerts)

        assert manager.modify_alert_bugs_called
        assert manager.email_alert_called
        assert "Failed to file alert bugs" in caplog.text

    def test_manage_alerts_continues_on_email_failure(
        self, mock_bug_manager, mock_email_manager, caplog
    ):
        """Test that manage_alerts continues after email_alerts fails."""

        class FailingEmailManager(ConcreteAlertManager):
            def _email_alert(self, *args, **kwargs):
                self.email_alert_called = True
                raise Exception("Email failed")

        manager = FailingEmailManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert()]
        with caplog.at_level(logging.WARNING):
            manager.manage_alerts(alerts)

        assert manager.email_alert_called
        assert manager.house_keeping_called
        assert "Failed to send email alerts" in caplog.text

    def test_manage_alerts_continues_on_housekeeping_failure(
        self, mock_bug_manager, mock_email_manager, caplog
    ):
        """Test that manage_alerts logs error when house_keeping fails."""

        class FailingHousekeepingManager(ConcreteAlertManager):
            def house_keeping(self, *args, **kwargs):
                self.house_keeping_called = True
                raise Exception("Housekeeping failed")

        manager = FailingHousekeepingManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert()]
        with caplog.at_level(logging.WARNING):
            manager.manage_alerts(alerts)

        assert manager.house_keeping_called
        assert "Housekeeping failed" in caplog.text

    def test_manage_alerts_filters_failed_alerts_before_modify(
        self, mock_bug_manager, mock_email_manager
    ):
        """Test that failed alerts are excluded before modify_alert_bugs."""

        class TrackingModifyManager(ConcreteAlertManager):
            def __init__(self, bug_manager, email_manager):
                super().__init__(bug_manager, email_manager)
                self.modify_alerts_count = 0

            def modify_alert_bugs(self, alerts, commented_bugs, new_bugs, *args, **kwargs):
                super().modify_alert_bugs(alerts, commented_bugs, new_bugs, *args, **kwargs)
                self.modify_alerts_count = len(alerts)

        manager = TrackingModifyManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert(), Alert(), Alert()]
        alerts[0].failed = True
        alerts[2].failed = True

        manager.manage_alerts(alerts)

        # Only 1 alert should be passed to modify_alert_bugs
        assert manager.modify_alerts_count == 1

    def test_file_alert_bugs_returns_list_of_bugs(self, concrete_alert_manager):
        """Test that file_alert_bugs returns a list of bug numbers."""
        alerts = [Alert(), Alert(), Alert()]
        bugs = concrete_alert_manager.file_alert_bugs(alerts)

        assert len(bugs) == 3
        assert all(bug == 789 for bug in bugs)

    def test_file_alert_bugs_handles_none_returns(self, mock_bug_manager, mock_email_manager):
        """Test that file_alert_bugs skips None returns from _file_alert_bug."""

        class NoneReturningManager(ConcreteAlertManager):
            def __init__(self, bug_manager, email_manager):
                super().__init__(bug_manager, email_manager)
                self.call_count = 0

            def _file_alert_bug(self, alert, *args, **kwargs):
                self.call_count += 1
                # Return None for odd calls, bug number for even calls
                return None if self.call_count % 2 == 1 else 999

        manager = NoneReturningManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert(), Alert(), Alert(), Alert()]
        bugs = manager.file_alert_bugs(alerts)

        assert len(bugs) == 2
        assert all(bug == 999 for bug in bugs)

    def test_email_alerts_calls_email_alert_for_each_alert(
        self, mock_bug_manager, mock_email_manager
    ):
        """Test that email_alerts calls _email_alert for each alert."""

        class CountingEmailManager(ConcreteAlertManager):
            def __init__(self, bug_manager, email_manager):
                super().__init__(bug_manager, email_manager)
                self.email_count = 0

            def _email_alert(self, alert, *args, **kwargs):
                self.email_count += 1

        manager = CountingEmailManager(mock_bug_manager, mock_email_manager)

        alerts = [Alert(), Alert(), Alert()]
        manager.email_alerts(alerts)

        assert manager.email_count == 3

    def test_update_alerts_not_implemented(self, base_alert_manager):
        """Test that update_alerts raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            base_alert_manager.update_alerts()

    def test_comment_alert_bugs_not_implemented(self, base_alert_manager):
        """Test that comment_alert_bugs raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            base_alert_manager.comment_alert_bugs([])

    def test_file_alert_bug_not_implemented(self, base_alert_manager):
        """Test that _file_alert_bug raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            base_alert_manager._file_alert_bug(Alert())

    def test_modify_alert_bugs_not_implemented(self, base_alert_manager):
        """Test that modify_alert_bugs raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            base_alert_manager.modify_alert_bugs([], [], [])

    def test_email_alert_not_implemented(self, base_alert_manager):
        """Test that _email_alert raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            base_alert_manager._email_alert(Alert())

    def test_house_keeping_not_implemented(self, base_alert_manager):
        """Test that house_keeping raises NotImplementedError."""
        with pytest.raises(NotImplementedError):
            base_alert_manager.house_keeping([], [], [])
