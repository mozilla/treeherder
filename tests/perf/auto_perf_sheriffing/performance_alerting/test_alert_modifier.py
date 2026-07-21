from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier import (
    PerformanceAlertSummaryModifier,
)
from treeherder.perf.models import PerformanceAlertSummary


class TestResolutionModifier:
    @pytest.fixture
    def resolution_modifier_class(self):
        for updater in PerformanceAlertSummaryModifier.get_updaters():
            if updater.__name__ == "ResolutionModifier":
                return updater
        pytest.fail("ResolutionModifier not found in updaters list")

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_no_bugs(self, mock_bug_searcher_class, resolution_modifier_class):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": []}
        mock_bug_searcher_class.return_value = mock_searcher

        updates, summaries = resolution_modifier_class.update_alerts()

        assert updates == {}
        assert summaries == {}

    @pytest.mark.parametrize(
        "resolution, expected_bug_status",
        [
            ("FIXED", PerformanceAlertSummary.BUG_FIXED),
            ("INVALID", PerformanceAlertSummary.BUG_INVALID),
            ("WONTFIX", PerformanceAlertSummary.BUG_WONTFIX),
            ("DUPLICATE", PerformanceAlertSummary.BUG_DUPLICATE),
            ("WORKSFORME", PerformanceAlertSummary.BUG_WORKSFORME),
            ("INCOMPLETE", PerformanceAlertSummary.BUG_INCOMPLETE),
            ("MOVED", PerformanceAlertSummary.BUG_MOVED),
        ],
    )
    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_resolution_mapping(
        self,
        mock_bug_searcher_class,
        resolution,
        expected_bug_status,
        resolution_modifier_class,
        test_perf_alert_summary_for_modifier,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [{"id": 12345, "resolution": resolution, "status": "RESOLVED"}]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        test_perf_alert_summary_for_modifier.bug_number = 12345
        test_perf_alert_summary_for_modifier.save()

        updates, summaries = resolution_modifier_class.update_alerts()

        assert (
            updates[str(test_perf_alert_summary_for_modifier.id)]["bug_status"]
            == expected_bug_status
        )
        assert str(test_perf_alert_summary_for_modifier.id) in summaries

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_with_multiple_bugs(
        self,
        mock_bug_searcher_class,
        resolution_modifier_class,
        test_perf_alert_summary_for_modifier,
        create_perf_alert_summary,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [
                {"id": 12345, "resolution": "FIXED", "status": "RESOLVED"},
                {"id": 67890, "resolution": "INVALID", "status": "RESOLVED"},
            ]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        summary2 = create_perf_alert_summary(bug_number=67890)
        test_perf_alert_summary_for_modifier.bug_number = 12345
        test_perf_alert_summary_for_modifier.save()

        updates, summaries = resolution_modifier_class.update_alerts()

        assert (
            updates[str(test_perf_alert_summary_for_modifier.id)]["bug_status"]
            == PerformanceAlertSummary.BUG_FIXED
        )
        assert updates[str(summary2.id)]["bug_status"] == PerformanceAlertSummary.BUG_INVALID
        assert str(test_perf_alert_summary_for_modifier.id) in summaries
        assert str(summary2.id) in summaries

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_bug_not_matching_any_summary(
        self,
        mock_bug_searcher_class,
        resolution_modifier_class,
        test_perf_alert_summary_for_modifier,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [{"id": 99999, "resolution": "FIXED", "status": "RESOLVED"}]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        test_perf_alert_summary_for_modifier.bug_number = 12345
        test_perf_alert_summary_for_modifier.save()

        updates, summaries = resolution_modifier_class.update_alerts()

        assert updates == {}
        assert summaries == {}

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_unknown_resolution_maps_to_bug_new(
        self,
        mock_bug_searcher_class,
        resolution_modifier_class,
        test_perf_alert_summary_for_modifier,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [{"id": 12345, "resolution": "UNKNOWN_RESOLUTION", "status": "RESOLVED"}]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        test_perf_alert_summary_for_modifier.bug_number = 12345
        test_perf_alert_summary_for_modifier.save()

        updates, summaries = resolution_modifier_class.update_alerts()

        assert updates == {}
        assert summaries == {}

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_with_empty_resolution_defaults_to_bug_new(
        self,
        mock_bug_searcher_class,
        resolution_modifier_class,
        test_perf_alert_summary_for_modifier,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [{"id": 12345, "resolution": "", "status": "ASSIGNED"}]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        test_perf_alert_summary_for_modifier.bug_number = 12345
        test_perf_alert_summary_for_modifier.save()

        updates, summaries = resolution_modifier_class.update_alerts()

        assert (
            updates[str(test_perf_alert_summary_for_modifier.id)]["bug_status"]
            == PerformanceAlertSummary.BUG_NEW
        )
        assert str(test_perf_alert_summary_for_modifier.id) in summaries

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_skips_summary_already_at_target_status(
        self,
        mock_bug_searcher_class,
        resolution_modifier_class,
        test_repository,
        push_stored,
        test_perf_framework,
        test_issue_tracker,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [{"id": 12345, "resolution": "FIXED", "status": "RESOLVED"}]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        summary = PerformanceAlertSummary.objects.create(
            repository=test_repository,
            framework=test_perf_framework,
            prev_push_id=1,
            push_id=2,
            manually_created=False,
            created=datetime.now(),
            bug_number=12345,
        )
        summary.bug_status = PerformanceAlertSummary.BUG_FIXED
        summary.save()

        updates, summaries = resolution_modifier_class.update_alerts()

        assert str(summary.id) not in updates

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_alerts_exception_handling(
        self, mock_bug_searcher_class, resolution_modifier_class, caplog
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.side_effect = Exception("API Error")
        mock_bug_searcher_class.return_value = mock_searcher

        updates, summaries = resolution_modifier_class.update_alerts()

        assert updates == {}
        assert summaries == {}
        assert "Failed to get bugs for alert resolution updates" in caplog.text
        assert "API Error" in caplog.text


class TestNullBugStatusModifier:
    @pytest.fixture
    def null_bug_status_modifier_class(self):
        for updater in PerformanceAlertSummaryModifier.get_updaters():
            if updater.__name__ == "NullBugStatusModifier":
                return updater
        pytest.fail("NullBugStatusModifier not found in updaters list")

    @pytest.fixture
    def summary_with_bug_number(self, test_perf_alert_summary_for_modifier):
        s = test_perf_alert_summary_for_modifier
        s.bug_number = 12345
        s.save()
        return s

    @pytest.mark.django_db
    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_no_matching_summaries_returns_empty(
        self, mock_bug_searcher_class, null_bug_status_modifier_class
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_bug_searcher_class.return_value = mock_searcher

        updates, summaries = null_bug_status_modifier_class.update_alerts()

        assert updates == {}
        assert summaries == {}
        mock_searcher.get_bugs.assert_not_called()

    @patch(
        "treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.PerformanceAlertSummary"
    )
    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_large_result_set_is_chunked(
        self, mock_bug_searcher_class, mock_pas_class, null_bug_status_modifier_class
    ):
        mock_pas_class.objects.filter.return_value = [Mock(bug_number=i) for i in range(51)]
        mock_pas_class.BUG_STATUSES = PerformanceAlertSummary.BUG_STATUSES

        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {"bugs": []}
        mock_bug_searcher_class.return_value = mock_searcher

        null_bug_status_modifier_class.update_alerts()

        assert mock_searcher.get_bugs.call_count == 2

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_update_bug_status(
        self,
        mock_bug_searcher_class,
        null_bug_status_modifier_class,
        test_perf_alert_summary_for_modifier,
        create_perf_alert_summary,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_searcher.get_bugs.return_value = {
            "bugs": [
                {"id": 12345, "resolution": "FIXED", "status": "RESOLVED"},
                {"id": 67890, "resolution": "", "status": "NEW"},
            ]
        }
        mock_bug_searcher_class.return_value = mock_searcher

        summary1 = test_perf_alert_summary_for_modifier
        summary1.bug_number = 12345
        summary1.save()

        summary2 = create_perf_alert_summary()
        summary2.bug_number = 67890
        summary2.save()

        updates, summaries = null_bug_status_modifier_class.update_alerts()

        assert updates[str(summary1.id)]["bug_status"] == PerformanceAlertSummary.BUG_FIXED
        assert updates[str(summary2.id)]["bug_status"] == PerformanceAlertSummary.BUG_NEW
        assert str(summary1.id) in summaries
        assert str(summary2.id) in summaries

    @patch("treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier.BugSearcher")
    def test_summary_outside_lookback_window_is_excluded(
        self,
        mock_bug_searcher_class,
        null_bug_status_modifier_class,
        test_perf_alert_summary_for_modifier,
    ):
        mock_searcher = Mock()
        mock_searcher.get_today_date.return_value = datetime.now().date()
        mock_bug_searcher_class.return_value = mock_searcher

        s = test_perf_alert_summary_for_modifier
        s.bug_number = 12345
        s.save()
        PerformanceAlertSummary.objects.filter(id=s.id).update(
            bug_updated=datetime.now() - timedelta(days=91)
        )

        updates, summaries = null_bug_status_modifier_class.update_alerts()

        assert updates == {}
        assert summaries == {}
        mock_searcher.get_bugs.assert_not_called()
