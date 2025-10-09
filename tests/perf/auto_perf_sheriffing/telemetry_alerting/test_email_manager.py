from unittest.mock import Mock, call, patch

import pytest

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.email_manager import (
    TelemetryEmail,
    TelemetryEmailContent,
    TelemetryEmailManager,
    TelemetryEmailWriter,
)


class TestTelemetryEmailManagerIntegration:
    """Integration tests with Taskcluster mocking."""

    @patch(
        "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
    )
    def test_email_manager_initialization_with_taskcluster(self, mock_notify_factory):
        """Test that EmailManager initializes with Taskcluster notify client."""
        mock_client = Mock()
        mock_notify_factory.return_value = mock_client

        email_manager = TelemetryEmailManager()

        # Verify taskcluster.notify_client_factory was called
        mock_notify_factory.assert_called_once()
        assert email_manager.notify_client == mock_client

    @patch(
        "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
    )
    def test_full_email_flow_with_taskcluster_mock(
        self, mock_notify_factory, telemetry_alert_obj, mock_probe
    ):
        """Test the full email flow from manager to Taskcluster notify client."""
        # Setup mock Taskcluster notify client
        mock_client = Mock()
        mock_email_func = Mock()
        mock_client.email = mock_email_func
        mock_notify_factory.return_value = mock_client

        # Create email manager
        email_manager = TelemetryEmailManager()

        # Execute email_alert
        email_manager.email_alert(mock_probe, telemetry_alert_obj)

        # Verify the Taskcluster email function was called
        assert mock_email_func.call_count == 1

        # Verify the email payload
        email_payload = mock_email_func.call_args[0][0]
        assert email_payload["address"] == "test@mozilla.com"
        assert email_payload["subject"] == "Telemetry Alert for Probe test_probe_metric"
        assert "MozDetect has detected a telemetry change" in email_payload["content"]

    @patch(
        "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
    )
    def test_multiple_emails_sent_to_taskcluster(
        self, mock_notify_factory, mock_probe, telemetry_alert_obj
    ):
        """Test that multiple emails are sent to different recipients via Taskcluster."""
        # Setup mock Taskcluster notify client
        mock_client = Mock()
        mock_email_func = Mock()
        mock_client.email = mock_email_func
        mock_notify_factory.return_value = mock_client

        # Setup probe with multiple notification emails
        mock_probe.name = "multi_email_probe"
        mock_probe.get_notification_emails.return_value = [
            "user1@mozilla.com",
            "user2@mozilla.com",
            "user3@mozilla.com",
        ]

        # Create email manager and send alerts
        email_manager = TelemetryEmailManager()
        email_manager.email_alert(mock_probe, telemetry_alert_obj)

        # Verify Taskcluster email was called 3 times
        assert mock_email_func.call_count == 3

        # Verify each email has the correct recipient
        calls = mock_email_func.call_args_list
        recipients = [call[0][0]["address"] for call in calls]
        assert "user1@mozilla.com" in recipients
        assert "user2@mozilla.com" in recipients
        assert "user3@mozilla.com" in recipients

    @patch(
        "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
    )
    def test_taskcluster_notify_client_not_called_during_initialization(self, mock_notify_factory):
        """Test that Taskcluster notify client is created during initialization."""
        mock_client = Mock()
        mock_notify_factory.return_value = mock_client

        # Create email manager
        TelemetryEmailManager()

        # Verify factory was called
        mock_notify_factory.assert_called_once()

    @patch(
        "treeherder.perf.auto_perf_sheriffing.base_email_manager.taskcluster.notify_client_factory"
    )
    def test_email_payload_structure(self, mock_notify_factory, telemetry_alert_obj, mock_probe):
        """Test that the email payload has the correct structure for Taskcluster."""
        mock_client = Mock()
        mock_email_func = Mock()
        mock_client.email = mock_email_func
        mock_notify_factory.return_value = mock_client

        email_manager = TelemetryEmailManager()
        email_manager.email_alert(mock_probe, telemetry_alert_obj)

        # Get the payload
        email_payload = mock_email_func.call_args[0][0]

        # Verify it's a dict with required keys
        assert isinstance(email_payload, dict)
        assert "address" in email_payload
        assert "subject" in email_payload
        assert "content" in email_payload

        # Verify the values are strings
        assert isinstance(email_payload["address"], str)
        assert isinstance(email_payload["subject"], str)
        assert isinstance(email_payload["content"], str)


class TestTelemetryEmailManager:
    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.email_manager.TelemetryEmail")
    def test_email_alert_sends_to_all_notification_emails(
        self, mock_telemetry_email_class, mock_probe, telemetry_alert_obj
    ):
        """Test that email_alert sends emails to all notification emails from probe."""
        # Setup mock probe with notification emails
        mock_probe.get_notification_emails.return_value = [
            "user1@mozilla.com",
            "user2@mozilla.com",
            "user3@mozilla.com",
        ]

        # Setup mock email instance
        mock_email_instance = Mock()
        mock_telemetry_email_class.return_value = mock_email_instance

        # Setup email manager
        email_manager = TelemetryEmailManager()
        mock_email_func = Mock()
        email_manager.get_email_func = Mock(return_value=mock_email_func)

        # Execute
        email_manager.email_alert(mock_probe, telemetry_alert_obj)

        # Verify TelemetryEmail was initialized with email function
        mock_telemetry_email_class.assert_called_once_with(mock_email_func)

        # Verify email was called for each notification address
        assert mock_email_instance.email.call_count == 3
        expected_calls = [
            call("user1@mozilla.com", mock_probe, telemetry_alert_obj),
            call("user2@mozilla.com", mock_probe, telemetry_alert_obj),
            call("user3@mozilla.com", mock_probe, telemetry_alert_obj),
        ]
        mock_email_instance.email.assert_has_calls(expected_calls)

    @patch("treeherder.perf.auto_perf_sheriffing.telemetry_alerting.email_manager.TelemetryEmail")
    def test_email_alert_with_single_notification_email(
        self, mock_telemetry_email_class, mock_probe, telemetry_alert_obj
    ):
        """Test email_alert with a single notification email."""
        mock_probe.get_notification_emails.return_value = ["single@mozilla.com"]

        mock_email_instance = Mock()
        mock_telemetry_email_class.return_value = mock_email_instance

        email_manager = TelemetryEmailManager()
        mock_email_func = Mock()
        email_manager.get_email_func = Mock(return_value=mock_email_func)

        email_manager.email_alert(mock_probe, telemetry_alert_obj)

        assert mock_email_instance.email.call_count == 1
        mock_email_instance.email.assert_called_once_with(
            "single@mozilla.com", mock_probe, telemetry_alert_obj
        )

    def test_get_email_func_returns_notify_client_email(self):
        """Test that get_email_func returns the notify_client.email method."""
        email_manager = TelemetryEmailManager()
        mock_email_method = Mock()
        email_manager.notify_client = Mock()
        email_manager.notify_client.email = mock_email_method

        result = email_manager.get_email_func()

        assert result == mock_email_method


class TestTelemetryEmail:
    def test_initialization(self):
        """Test TelemetryEmail initialization."""
        mock_email_func = Mock()

        telemetry_email = TelemetryEmail(mock_email_func)

        assert telemetry_email.email_func == mock_email_func
        assert isinstance(telemetry_email.email_writer, TelemetryEmailWriter)
        assert telemetry_email.email_client is None

    def test_email_calls_email_func_with_prepared_email(self, telemetry_alert_obj, mock_probe):
        """Test that email method calls email_func with prepared email payload."""
        mock_email_func = Mock()
        mock_probe.name = "test_probe"

        telemetry_email = TelemetryEmail(mock_email_func)

        # Execute
        telemetry_email.email("test@mozilla.com", mock_probe, telemetry_alert_obj)

        # Verify email_func was called once
        assert mock_email_func.call_count == 1

        # Verify the email payload was passed
        email_payload = mock_email_func.call_args[0][0]
        assert email_payload["address"] == "test@mozilla.com"
        assert email_payload["subject"] == "Telemetry Alert for Probe test_probe"
        assert "MozDetect has detected a telemetry change" in email_payload["content"]

    def test_set_email_method(self):
        """Test _set_email_method sets the email function."""
        mock_func1 = Mock()
        mock_func2 = Mock()

        telemetry_email = TelemetryEmail(mock_func1)
        assert telemetry_email.email_func == mock_func1

        telemetry_email._set_email_method(mock_func2)
        assert telemetry_email.email_func == mock_func2

    def test_prepare_email_returns_email_payload(self, telemetry_alert_obj, mock_probe):
        """Test _prepare_email returns properly formatted email payload."""
        mock_email_func = Mock()
        mock_probe.name = "test_probe"

        telemetry_email = TelemetryEmail(mock_email_func)

        result = telemetry_email._prepare_email("test@mozilla.com", mock_probe, telemetry_alert_obj)

        assert result["address"] == "test@mozilla.com"
        assert result["subject"] == "Telemetry Alert for Probe test_probe"
        assert result["content"] is not None


class TestTelemetryEmailWriter:
    def test_prepare_email_creates_complete_email(self, telemetry_alert_obj, mock_probe):
        """Test prepare_email creates a complete email with all required fields."""
        mock_probe.name = "test_probe"

        writer = TelemetryEmailWriter()
        result = writer.prepare_email("test@mozilla.com", mock_probe, telemetry_alert_obj)

        assert result["address"] == "test@mozilla.com"
        assert result["subject"] == "Telemetry Alert for Probe test_probe"
        assert "MozDetect has detected a telemetry change" in result["content"]

    def test_write_address_sets_email_address(self):
        """Test _write_address sets the email address."""
        writer = TelemetryEmailWriter()
        writer._write_address("test@mozilla.com")

        assert writer._email.address == "test@mozilla.com"

    def test_write_subject_includes_probe_name(self, mock_probe):
        """Test _write_subject includes the probe name in the subject."""
        mock_probe.name = "memory_total"

        writer = TelemetryEmailWriter()
        writer._write_subject(mock_probe)

        assert writer._email.subject == "Telemetry Alert for Probe memory_total"

    def test_write_content_sets_email_content(self, telemetry_alert_obj, mock_probe):
        """Test _write_content sets the email content."""
        mock_probe.name = "test_probe"

        writer = TelemetryEmailWriter()
        writer._write_content(mock_probe, telemetry_alert_obj)

        assert writer._email.content is not None
        assert "MozDetect has detected a telemetry change" in writer._email.content


class TestTelemetryEmailContent:
    def test_initialization(self):
        """Test TelemetryEmailContent initialization."""
        content = TelemetryEmailContent()

        assert content._raw_content is None

    def test_write_email_initializes_content(self, telemetry_alert_obj, mock_probe):
        """Test write_email initializes the content."""
        content = TelemetryEmailContent()

        content.write_email(mock_probe, telemetry_alert_obj)

        assert content._raw_content is not None
        assert TelemetryEmailContent.DESCRIPTION in content._raw_content
        assert TelemetryEmailContent.TABLE_HEADERS in content._raw_content

    def test_write_email_includes_probe_information(self, telemetry_alert_obj, mock_probe):
        """Test write_email includes probe information in the table."""
        content = TelemetryEmailContent()

        content.write_email(mock_probe, telemetry_alert_obj)

        result = str(content)
        # Should include channel
        assert "Windows" in result  # platform from signature
        assert "Nightly" in result  # channel from signature

    def test_write_email_without_related_alerts(self, telemetry_alert_obj, mock_probe):
        """Test write_email without related alerts."""
        content = TelemetryEmailContent()

        content.write_email(mock_probe, telemetry_alert_obj)

        result = str(content)
        assert "MozDetect has detected a telemetry change" in result
        assert TelemetryEmailContent.ADDITIONAL_PROBES not in result

    def test_write_email_with_related_alerts(
        self, telemetry_alert_obj, mock_probe, create_telemetry_signature, create_telemetry_alert
    ):
        """Test write_email with related alerts."""
        # Create a related alert
        sig2 = create_telemetry_signature(probe="related_probe")
        create_telemetry_alert(sig2)

        content = TelemetryEmailContent()

        content.write_email(mock_probe, telemetry_alert_obj)

        result = str(content)
        assert "MozDetect has detected a telemetry change" in result
        assert TelemetryEmailContent.ADDITIONAL_PROBES in result
        assert "related_probe" in result

    def test_initialize_report_intro_only_once(self, telemetry_alert_obj, mock_probe):
        """Test _initialize_report_intro only initializes once."""
        content = TelemetryEmailContent()

        content.write_email(mock_probe, telemetry_alert_obj)
        first_content = content._raw_content

        content._initialize_report_intro()
        assert content._raw_content == first_content

    def test_include_probe_adds_table_row(self, telemetry_alert_obj):
        """Test _include_probe adds a table row."""
        content = TelemetryEmailContent()
        content._initialize_report_intro()

        initial_content = content._raw_content

        detection_range = telemetry_alert_obj.get_detection_range()
        content._include_probe(
            detection_range,
            telemetry_alert_obj.telemetry_signature,
            telemetry_alert_obj.telemetry_alert_summary,
        )

        assert len(content._raw_content) > len(initial_content)
        assert "networking_http_channel_page_open_to_first_sent" in content._raw_content

    def test_build_table_row_format(self, telemetry_alert_obj):
        """Test _build_table_row creates properly formatted markdown table row."""
        content = TelemetryEmailContent()
        detection_range = telemetry_alert_obj.get_detection_range()

        row = content._build_table_row(
            detection_range,
            telemetry_alert_obj.telemetry_signature,
            telemetry_alert_obj.telemetry_alert_summary,
        )

        # Should be a markdown table row with pipes
        assert row.startswith("|")
        assert row.endswith("|")
        assert row.count("|") == 6  # 5 columns means 6 pipes

        # Should include key information
        assert "Nightly" in row  # channel
        assert "Windows" in row  # platform
        assert "networking_http_channel_page_open_to_first_sent" in row  # probe name

        # Should include markdown links
        assert "[" in row and "]" in row and "(" in row and ")" in row

    def test_build_table_row_includes_dates(self, telemetry_alert_obj):
        """Test _build_table_row includes formatted dates."""
        content = TelemetryEmailContent()
        detection_range = telemetry_alert_obj.get_detection_range()

        row = content._build_table_row(
            detection_range,
            telemetry_alert_obj.telemetry_signature,
            telemetry_alert_obj.telemetry_alert_summary,
        )

        # Should include dates in YYYY-MM-DD format
        assert "2024-01-14" in row  # from date
        assert "2024-01-16" in row  # to date

    def test_build_table_row_includes_links(self, telemetry_alert_obj):
        """Test _build_table_row includes proper links."""
        content = TelemetryEmailContent()
        detection_range = telemetry_alert_obj.get_detection_range()

        row = content._build_table_row(
            detection_range,
            telemetry_alert_obj.telemetry_signature,
            telemetry_alert_obj.telemetry_alert_summary,
        )

        # Should include Glean Dictionary link
        assert "dictionary.telemetry.mozilla.org" in row

        # Should include Treeherder links
        assert "treeherder.mozilla.org" in row

        # Should have markdown link format
        assert "[Detection Push]" in row

    def test_str_returns_raw_content(self, telemetry_alert_obj, mock_probe):
        """Test __str__ returns the raw content."""
        content = TelemetryEmailContent()

        content.write_email(mock_probe, telemetry_alert_obj)

        result = str(content)
        assert result == content._raw_content
        assert "MozDetect has detected a telemetry change" in result

    def test_str_raises_error_when_no_content(self):
        """Test __str__ raises ValueError when no content is set."""
        content = TelemetryEmailContent()

        with pytest.raises(ValueError) as exc_info:
            str(content)

        assert "No content set" in str(exc_info.value)

    def test_include_additional_probes_adds_section(
        self, telemetry_alert_obj, create_telemetry_signature, create_telemetry_alert
    ):
        """Test _include_additional_probes adds the additional probes section."""
        # Create related alerts
        sig2 = create_telemetry_signature(probe="related_probe_1")
        create_telemetry_alert(sig2)

        content = TelemetryEmailContent()
        content._initialize_report_intro()

        content._include_additional_probes(telemetry_alert_obj)

        result = str(content)
        assert TelemetryEmailContent.ADDITIONAL_PROBES in result
        assert "related_probe_1" in result

    def test_content_description_constant(self):
        """Test that DESCRIPTION constant is properly defined."""
        assert "MozDetect has detected a telemetry change" in TelemetryEmailContent.DESCRIPTION
        assert "---" in TelemetryEmailContent.DESCRIPTION

    def test_table_headers_constant(self):
        """Test that TABLE_HEADERS constant is properly defined."""
        headers = TelemetryEmailContent.TABLE_HEADERS
        assert "| Channel | Probe | Platform | Date Range | Detection Push |" in headers
        assert ":---:" in headers  # Markdown center alignment

    def test_additional_probes_constant(self):
        """Test that ADDITIONAL_PROBES constant is properly defined."""
        assert "additional probes" in TelemetryEmailContent.ADDITIONAL_PROBES
        assert "---" in TelemetryEmailContent.ADDITIONAL_PROBES
