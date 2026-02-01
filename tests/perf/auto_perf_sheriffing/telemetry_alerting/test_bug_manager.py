from unittest.mock import patch

import pytest
import responses

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_manager import (
    TelemetryBugContent,
    TelemetryBugManager,
)


@pytest.fixture
def bug_manager(mock_bugfiler_settings):
    """Fixture providing a TelemetryBugManager instance."""
    return TelemetryBugManager()


class TestTelemetryBugManager:
    """Tests for the TelemetryBugManager class."""

    def test_initialization(self, bug_manager):
        """Test TelemetryBugManager initialization."""
        assert bug_manager.bz_url == "https://bugzilla.mozilla.org/rest/bug"
        assert bug_manager.bz_headers == {"Accept": "application/json"}

    @responses.activate
    def test_file_bug_success(self, bug_manager, mock_probe, telemetry_alert_obj):
        """Test successfully filing a bug."""
        expected_response = {"id": 123456}
        responses.add(
            responses.POST,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        result = bug_manager.file_bug(mock_probe, telemetry_alert_obj)

        assert result == expected_response
        assert len(responses.calls) == 1

        # Verify the request data
        request = responses.calls[0].request
        assert request.headers["x-bugzilla-api-key"] == "test-api-key"

    @responses.activate
    def test_file_bug_sets_correct_fields(self, bug_manager, mock_probe, telemetry_alert_obj):
        """Test that file_bug sets all required fields correctly."""
        expected_response = {"id": 123456}
        responses.add(
            responses.POST,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        bug_manager.file_bug(mock_probe, telemetry_alert_obj)

        # Verify bug was filed with correct structure
        import json

        request_body = json.loads(responses.calls[0].request.body)

        # Check basic fields
        assert "summary" in request_body
        assert "description" in request_body
        assert request_body["product"] == "Testing"
        assert request_body["component"] == "Performance"
        assert request_body["severity"] == "S4"
        assert request_body["priority"] == "P5"
        assert request_body["keywords"] == "telemetry-alert,regression"

        # Check needinfo flag
        assert "flags" in request_body
        assert len(request_body["flags"]) == 1
        assert request_body["flags"][0]["name"] == "needinfo"
        assert request_body["flags"][0]["status"] == "?"
        assert request_body["flags"][0]["requestee"] == "test@mozilla.com"

    @responses.activate
    def test_file_bug_includes_bug_content(self, bug_manager, mock_probe, telemetry_alert_obj):
        """Test that file_bug includes bug content from TelemetryBugContent."""
        expected_response = {"id": 123456}
        responses.add(
            responses.POST,
            "https://bugzilla.mozilla.org/rest/bug",
            json=expected_response,
            status=200,
        )

        with patch.object(TelemetryBugContent, "build_bug_content") as mock_build:
            mock_build.return_value = {
                "title": "Test Alert Title",
                "description": "Test alert description",
            }

            bug_manager.file_bug(mock_probe, telemetry_alert_obj)

            # Verify build_bug_content was called with probe and alert
            mock_build.assert_called_once_with(mock_probe, telemetry_alert_obj)

    @responses.activate
    def test_modify_bug_success(self, bug_manager):
        """Test successfully modifying a bug."""
        expected_response = {"bugs": [{"id": 123456, "changes": {}}]}
        responses.add(
            responses.PUT,
            "https://bugzilla.mozilla.org/rest/bug/123456",
            json=expected_response,
            status=200,
        )

        bug_manager.modify_bug(123456, {"comment": {"body": "Test comment"}})

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.headers["x-bugzilla-api-key"] == "test-commenter-key"

    @responses.activate
    def test_modify_bug_sends_correct_changes(self, bug_manager):
        """Test that modify_bug sends the correct change data."""
        expected_response = {"bugs": [{"id": 999, "changes": {}}]}
        responses.add(
            responses.PUT,
            "https://bugzilla.mozilla.org/rest/bug/999",
            json=expected_response,
            status=200,
        )

        changes = {"comment": {"body": "Additional information"}}
        bug_manager.modify_bug(999, changes)

        import json

        request_body = json.loads(responses.calls[0].request.body)
        assert request_body == changes

    def test_comment_bug_not_implemented(self, bug_manager, telemetry_alert_obj):
        """Test that comment_bug is not implemented yet."""
        result = bug_manager.comment_bug(telemetry_alert_obj)
        assert result is None


class TestTelemetryBugContent:
    """Tests for the TelemetryBugContent class."""

    @pytest.fixture
    def bug_content(self):
        """Fixture providing a TelemetryBugContent instance."""
        return TelemetryBugContent()

    def test_build_bug_content_returns_title_and_description(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that build_bug_content returns title and description."""
        result = bug_content.build_bug_content(mock_probe, telemetry_alert_obj)

        assert "title" in result
        assert "description" in result
        assert isinstance(result["title"], str)
        assert isinstance(result["description"], str)

    def test_build_bug_content_title_format(self, bug_content, mock_probe, telemetry_alert_obj):
        """Test that the bug title is formatted correctly."""
        result = bug_content.build_bug_content(mock_probe, telemetry_alert_obj)

        assert "Telemetry Alert for" in result["title"]
        assert "networking_http_channel_page_open_to_first_sent" in result["title"]
        assert "2024-01-15" in result["title"]

    def test_build_bug_content_description_includes_required_elements(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that the bug description includes all required elements."""
        result = bug_content.build_bug_content(mock_probe, telemetry_alert_obj)

        description = result["description"]

        # Check for key elements in the description
        assert "MozDetect has detected changes" in description
        assert "2024-01-15" in description
        assert "Treeherder pushes" in description or "detection_push_link" in description
        assert "push log" in description or "push_log_link" in description

    def test_build_bug_content_description_includes_change_table(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that the bug description includes the change table."""
        result = bug_content.build_bug_content(mock_probe, telemetry_alert_obj)

        description = result["description"]

        # Check for table elements
        assert "Probe" in description
        assert "Platform" in description
        assert "Previous Values" in description
        assert "New Values" in description

    def test_build_bug_content_includes_telemetry_alert_dashboard_link(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that build_bug_content includes telemetry alert dashboard link with alert summary ID."""
        result = bug_content.build_bug_content(mock_probe, telemetry_alert_obj)

        # The description should include the telemetry alert dashboard link with the alert summary ID
        assert "gmierz.github.io/telemetry-alert-dashboard" in result["description"]
        assert (
            f"alertSummaryId={telemetry_alert_obj.telemetry_alert_summary.id}"
            in result["description"]
        )

    def test_build_comment_content_not_implemented(self, bug_content, telemetry_alert_obj):
        """Test that build_comment_content is not yet implemented."""
        result = bug_content.build_comment_content(telemetry_alert_obj)

        # Currently returns None as it's not implemented
        assert result is None

    def test_build_change_table_includes_probe_info(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_change_table includes probe information."""
        result = bug_content._build_change_table(mock_probe, telemetry_alert_obj)

        # Should include probe name
        assert "networking_http_channel_page_open_to_first_sent" in result
        # Should include platform
        assert "Windows" in result

    def test_build_change_table_includes_values(self, bug_content, mock_probe, telemetry_alert_obj):
        """Test that _build_change_table includes metric values."""
        result = bug_content._build_change_table(mock_probe, telemetry_alert_obj)

        # Should include median values
        assert "650.0" in result  # prev_median
        assert "750.0" in result  # new_median

        # Should include P05 values
        assert "700.0" in result  # prev_p05
        assert "800.0" in result  # new_p05

        # Should include P95 values
        assert "720.0" in result  # prev_p95
        assert "820.0" in result  # new_p95

    def test_build_probe_alert_row_formats_correctly(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_probe_alert_row formats the row correctly."""
        result = bug_content._build_probe_alert_row(mock_probe, telemetry_alert_obj)

        # Check markdown table format
        assert "|" in result
        assert "Median:" in result
        assert "P05:" in result
        assert "P95:" in result

    def test_build_probe_alert_row_includes_glean_dictionary_link(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_probe_alert_row includes Glean Dictionary link."""
        with patch(
            "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_manager.get_glean_dictionary_link"
        ) as mock_link:
            mock_link.return_value = "https://dictionary.telemetry.mozilla.org/test"

            result = bug_content._build_probe_alert_row(mock_probe, telemetry_alert_obj)

            mock_link.assert_called_once_with(telemetry_alert_obj.telemetry_signature)
            assert "https://dictionary.telemetry.mozilla.org/test" in result

    def test_build_bug_content_calculates_date_range_correctly(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that build_bug_content calculates the detection date range correctly."""
        result = bug_content.build_bug_content(mock_probe, telemetry_alert_obj)

        description = result["description"]

        # Should include start date (prev_push date)
        assert "2024-01-14" in description

        # Should include end date + 1 day (next_push date + 1)
        assert "2024-01-17" in description

    @patch(
        "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_manager.get_treeherder_detection_link"
    )
    @patch(
        "treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_manager.get_treeherder_detection_range_link"
    )
    def test_build_bug_content_calls_link_builders(
        self, mock_range_link, mock_detection_link, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that build_bug_content calls the link builder functions."""
        mock_detection_link.return_value = "https://treeherder.mozilla.org/detection"
        mock_range_link.return_value = "https://treeherder.mozilla.org/range"

        result = bug_content.build_bug_content(mock_probe, telemetry_alert_obj)

        # Verify the link builders were called
        assert mock_detection_link.called
        assert mock_range_link.called

        # Verify links are included in description
        assert "https://treeherder.mozilla.org/detection" in result["description"]
        assert "https://treeherder.mozilla.org/range" in result["description"]

    def test_table_headers_constant(self, bug_content):
        """Test that TABLE_HEADERS constant is formatted correctly."""
        assert "Probe" in bug_content.TABLE_HEADERS
        assert "Platform" in bug_content.TABLE_HEADERS
        assert "Previous Values" in bug_content.TABLE_HEADERS
        assert "New Values" in bug_content.TABLE_HEADERS
        assert "|" in bug_content.TABLE_HEADERS

    def test_bug_title_constant_format(self, bug_content):
        """Test that BUG_TITLE constant has correct format placeholders."""
        assert "{probe}" in bug_content.BUG_TITLE
        assert "{date}" in bug_content.BUG_TITLE

    def test_bug_description_constant_format(self, bug_content):
        """Test that BUG_DESCRIPTION constant has correct format placeholders."""
        assert "{date}" in bug_content.BUG_DESCRIPTION
        assert "{detection_push_link}" in bug_content.BUG_DESCRIPTION
        assert "{change_table}" in bug_content.BUG_DESCRIPTION
        assert "{detection_range_link}" in bug_content.BUG_DESCRIPTION
        assert "{push_log_link}" in bug_content.BUG_DESCRIPTION
        assert "{telemetry_alert_dashboard}" in bug_content.BUG_DESCRIPTION

    def test_bug_comment_constant_format(self, bug_content):
        """Test that BUG_COMMENT constant has correct format placeholders."""
        assert "{change_table}" in bug_content.BUG_COMMENT
        assert "additional probes" in bug_content.BUG_COMMENT

    def test_build_change_table_uses_correct_title_for_regression(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_change_table uses 'Changes Detected' title for regressions."""
        telemetry_alert_obj.telemetry_alert.is_regression = True

        result = bug_content._build_change_table(mock_probe, telemetry_alert_obj)

        assert "### Changes Detected" in result

    def test_build_change_table_uses_generic_title_for_non_regression(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_change_table uses 'Changes Detected' title for non-regressions."""
        telemetry_alert_obj.telemetry_alert.is_regression = False

        result = bug_content._build_change_table(mock_probe, telemetry_alert_obj)

        assert "### Changes Detected" in result

    def test_get_sample_difference_warning_returns_empty_when_difference_below_threshold(
        self, bug_content, telemetry_alert_obj
    ):
        """Test that no warning is returned when sample difference is < 20%."""
        telemetry_alert_obj.telemetry_alert.prev_value = 1000
        telemetry_alert_obj.telemetry_alert.new_value = 1150  # 15% increase

        result = bug_content._get_sample_difference_warning(telemetry_alert_obj)

        assert result == ""

    def test_get_sample_difference_warning_returns_warning_when_difference_at_threshold(
        self, bug_content, telemetry_alert_obj
    ):
        """Test that warning is returned when sample difference is exactly 20%."""
        telemetry_alert_obj.telemetry_alert.prev_value = 1000
        telemetry_alert_obj.telemetry_alert.new_value = 1200  # 20% increase

        result = bug_content._get_sample_difference_warning(telemetry_alert_obj)

        assert "Warning" in result
        assert "20.0%" in result
        assert "1000" in result
        assert "1200" in result

    def test_get_sample_difference_warning_handles_decrease_in_samples(
        self, bug_content, telemetry_alert_obj
    ):
        """Test that warning is returned for sample decrease >= 20%."""
        telemetry_alert_obj.telemetry_alert.prev_value = 1000
        telemetry_alert_obj.telemetry_alert.new_value = 750  # 25% decrease

        result = bug_content._get_sample_difference_warning(telemetry_alert_obj)

        assert "Warning" in result
        assert "25.0%" in result
        assert "1000" in result
        assert "750" in result

    def test_get_sample_difference_warning_returns_empty_when_prev_value_is_zero(
        self, bug_content, telemetry_alert_obj
    ):
        """Test that no warning is returned when prev_value is 0 (avoid division by zero)."""
        telemetry_alert_obj.telemetry_alert.prev_value = 0
        telemetry_alert_obj.telemetry_alert.new_value = 1000

        result = bug_content._get_sample_difference_warning(telemetry_alert_obj)

        assert result == ""

    def test_get_detection_warnings_calls_sample_difference_warning(
        self, bug_content, telemetry_alert_obj
    ):
        """Test that _get_detection_warnings calls _get_sample_difference_warning."""
        telemetry_alert_obj.telemetry_alert.prev_value = 1000
        telemetry_alert_obj.telemetry_alert.new_value = 1500  # 50% increase

        result = bug_content._get_detection_warnings(telemetry_alert_obj)

        assert "Warning" in result
        assert "50.0%" in result

    def test_get_detection_warnings_returns_empty_when_no_warnings(
        self, bug_content, telemetry_alert_obj
    ):
        """Test that _get_detection_warnings returns empty string when no warnings are needed."""
        telemetry_alert_obj.telemetry_alert.prev_value = 1000
        telemetry_alert_obj.telemetry_alert.new_value = 1100  # 10% increase

        result = bug_content._get_detection_warnings(telemetry_alert_obj)

        assert result == ""

    def test_build_change_table_includes_sample_warning(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_change_table includes sample warning when threshold is met."""
        telemetry_alert_obj.telemetry_alert.prev_value = 1000
        telemetry_alert_obj.telemetry_alert.new_value = 1500  # 50% increase

        result = bug_content._build_change_table(mock_probe, telemetry_alert_obj)

        assert "### Changes Detected" in result
        assert "Warning" in result
        assert "50.0%" in result
        assert "Probe" in result  # Table headers should still be present

    def test_build_change_table_excludes_sample_warning_when_not_needed(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_change_table excludes sample warning when threshold is not met."""
        telemetry_alert_obj.telemetry_alert.prev_value = 1000
        telemetry_alert_obj.telemetry_alert.new_value = 1100  # 10% increase

        result = bug_content._build_change_table(mock_probe, telemetry_alert_obj)

        assert "### Changes Detected" in result
        assert "Warning" not in result
        assert "Probe" in result  # Table headers should still be present

    def test_build_probe_alert_row_includes_time_unit(
        self, bug_content, mock_probe, telemetry_alert_obj
    ):
        """Test that _build_probe_alert_row includes time unit from probe."""
        result = bug_content._build_probe_alert_row(mock_probe, telemetry_alert_obj)

        # Check that the time unit "ns" is included with the values (mock_probe uses nanosecond)
        assert "650.0ns" in result  # prev_median
        assert "750.0ns" in result  # new_median
        assert "700.0ns" in result  # prev_p05
        assert "800.0ns" in result  # new_p05
        assert "720.0ns" in result  # prev_p95
        assert "820.0ns" in result  # new_p95

    def test_build_probe_alert_row_without_time_unit(self, bug_content, telemetry_alert_obj):
        """Test that _build_probe_alert_row works when probe has no time unit."""
        from unittest.mock import Mock

        probe_without_unit = Mock()
        probe_without_unit.time_unit = ""

        result = bug_content._build_probe_alert_row(probe_without_unit, telemetry_alert_obj)

        # Check that values are present without units
        assert "650.0" in result  # prev_median
        assert "750.0" in result  # new_median
        # Should not have "ms" when unit is empty
        assert "650.0ms" not in result

    def test_normalize_time_unit_conversion(self, bug_content):
        """Test that full time unit names are converted."""
        assert bug_content._normalize_time_unit("nanosecond") == "ns"
        assert bug_content._normalize_time_unit("microsecond") == "us"
        assert bug_content._normalize_time_unit("millisecond") == "ms"
        assert bug_content._normalize_time_unit("MICROSECOND") == "us"
        assert bug_content._normalize_time_unit("second") == "s"
        assert bug_content._normalize_time_unit("ms") == "ms"
        assert bug_content._normalize_time_unit("") == ""

    def test_unit_convserion(self, bug_content):
        """Test conversion from nanoseconds to nanoseconds."""
        assert bug_content._convert_from_nanoseconds(1000, "ns") == 1000
        assert bug_content._convert_from_nanoseconds(5000, "us") == 5.0
        assert bug_content._convert_from_nanoseconds(650_000_000, "ms") == 650.0
        assert bug_content._convert_from_nanoseconds(1000, "unknown") == 1000

    def test_build_probe_alert_row_converts_values_correctly(
        self, bug_content, telemetry_alert_obj
    ):
        """Test that _build_probe_alert_row converts nanosecond values to ms correctly."""
        from unittest.mock import Mock

        # Set up alert with nanosecond values
        telemetry_alert_obj.telemetry_alert.prev_median = 650_000_000  # 650ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.new_median = 750_000_000  # 750ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.prev_p05 = 700_000_000  # 700ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.new_p05 = 800_000_000  # 800ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.prev_p95 = 720_000_000  # 720ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.new_p95 = 820_000_000  # 820ms in nanoseconds

        probe = Mock()
        probe.time_unit = "ms"

        result = bug_content._build_probe_alert_row(probe, telemetry_alert_obj)

        # Check that the converted values appear in the result
        assert "650.0ms" in result  # prev_median
        assert "750.0ms" in result  # new_median
        assert "700.0ms" in result  # prev_p05
        assert "800.0ms" in result  # new_p05
        assert "720.0ms" in result  # prev_p95
        assert "820.0ms" in result  # new_p95

    def test_build_probe_alert_row_with_full_unit_name(self, bug_content, telemetry_alert_obj):
        """Test that _build_probe_alert_row handles full unit names like 'millisecond'."""
        from unittest.mock import Mock

        # Set up alert with nanosecond values
        telemetry_alert_obj.telemetry_alert.prev_median = 650_000_000  # 650ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.new_median = 750_000_000  # 750ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.prev_p05 = 700_000_000  # 700ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.new_p05 = 800_000_000  # 800ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.prev_p95 = 720_000_000  # 720ms in nanoseconds
        telemetry_alert_obj.telemetry_alert.new_p95 = 820_000_000  # 820ms in nanoseconds

        probe = Mock()
        probe.time_unit = "millisecond"  # Full name instead of shorthand

        result = bug_content._build_probe_alert_row(probe, telemetry_alert_obj)

        # Check that the converted values appear with shorthand unit
        assert "650.0ms" in result  # prev_median
        assert "750.0ms" in result  # new_median
        assert "700.0ms" in result  # prev_p05
        assert "800.0ms" in result  # new_p05
        assert "720.0ms" in result  # prev_p95
        assert "820.0ms" in result  # new_p95
