from unittest.mock import MagicMock, patch

import pytest

from treeherder.perf.auto_perf_sheriffing.base_email_manager import EmailManager


@pytest.fixture
def mock_taskcluster_notify():
    """Mock the taskcluster notify client factory."""
    with patch(
        "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
    ) as mock_factory:
        mock_client = MagicMock()
        mock_factory.return_value = mock_client
        yield mock_client


@pytest.fixture
def email_manager(mock_taskcluster_notify):
    """Fixture providing an EmailManager instance."""
    return EmailManager()


class TestEmailManager:
    """Tests for the EmailManager base class."""

    def test_email_manager_initialization(self, mock_taskcluster_notify):
        """Test EmailManager initialization sets notify_client."""
        manager = EmailManager()
        assert manager.notify_client is mock_taskcluster_notify

    def test_email_manager_calls_notify_client_factory(self):
        """Test EmailManager calls taskcluster.notify_client_factory during init."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
        ) as mock_factory:
            mock_client = MagicMock()
            mock_factory.return_value = mock_client

            manager = EmailManager()

            mock_factory.assert_called_once()
            assert manager.notify_client == mock_client

    def test_get_email_func_returns_client_email(self, email_manager, mock_taskcluster_notify):
        """Test get_email_func returns the notify_client.email method."""
        email_func = email_manager.get_email_func()
        assert email_func is mock_taskcluster_notify.email

    def test_get_email_func_is_callable(self, email_manager):
        """Test get_email_func returns a callable."""
        email_func = email_manager.get_email_func()
        assert callable(email_func)

    def test_email_alert_is_no_op(self, email_manager):
        """Test email_alert does nothing by default."""
        # Should not raise any exceptions
        result = email_manager.email_alert()
        assert result is None

    def test_email_alert_with_args(self, email_manager):
        """Test email_alert accepts arbitrary args and kwargs."""
        result = email_manager.email_alert("arg1", "arg2", kwarg1="value1", kwarg2="value2")
        assert result is None

    def test_notify_client_is_set_on_initialization(self):
        """Test that notify_client is set during initialization."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
        ) as mock_factory:
            mock_client = MagicMock()
            mock_factory.return_value = mock_client

            manager = EmailManager()

            # Verify notify_client was set
            assert hasattr(manager, "notify_client")
            assert manager.notify_client is not None

    def test_multiple_email_managers_use_separate_clients(self):
        """Test that multiple EmailManager instances get separate notify clients."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
        ) as mock_factory:
            mock_client1 = MagicMock()
            mock_client2 = MagicMock()
            mock_factory.side_effect = [mock_client1, mock_client2]

            manager1 = EmailManager()
            manager2 = EmailManager()

            assert manager1.notify_client is mock_client1
            assert manager2.notify_client is mock_client2
            assert manager1.notify_client is not manager2.notify_client

    def test_get_email_func_can_be_called_multiple_times(
        self, email_manager, mock_taskcluster_notify
    ):
        """Test get_email_func can be called multiple times and returns same function."""
        email_func1 = email_manager.get_email_func()
        email_func2 = email_manager.get_email_func()

        assert email_func1 is email_func2
        assert email_func1 is mock_taskcluster_notify.email

    def test_email_manager_with_mocked_notify_client(self):
        """Test EmailManager with a fully mocked notify client."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
        ) as mock_factory:
            mock_client = MagicMock()
            mock_email_method = MagicMock(return_value={"sent": True})
            mock_client.email = mock_email_method
            mock_factory.return_value = mock_client

            manager = EmailManager()
            email_func = manager.get_email_func()

            # Call the email function
            result = email_func(
                address="test@example.com", subject="Test Subject", content="Test Content"
            )

            # Verify the email method was called correctly
            mock_email_method.assert_called_once_with(
                address="test@example.com", subject="Test Subject", content="Test Content"
            )
            assert result == {"sent": True}
