import sys
from types import ModuleType
from unittest.mock import Mock, patch

import pytest

from treeherder.perf.auto_perf_sheriffing.sherlock import Sherlock
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.probe import TelemetryProbe
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    DEFAULT_ALERT_EMAIL,
)
from treeherder.perf.models import PerformanceFramework, PerformanceTelemetrySignature


@pytest.fixture
def sherlock():
    return Sherlock(Mock(), Mock(), Mock())


@pytest.fixture
def fake_mozdetect(monkeypatch):
    """Fake mozdetect module for the lazy imports done in Sherlock.

    Injected through sys.modules so that the `import mozdetect` calls made inside
    the telemetry alerting methods pick this up instead of the real module (which
    would require BigQuery access).
    """
    telemetry_query = ModuleType("mozdetect.telemetry_query")
    telemetry_query.get_metric_labels = Mock(return_value=[])
    telemetry_query.get_metric_table = Mock(return_value=Mock(empty=True))

    mozdetect = ModuleType("mozdetect")
    mozdetect.telemetry_query = telemetry_query
    mozdetect.get_timeseries_detectors = Mock(return_value={"cdf_squared": Mock()})
    mozdetect.TelemetryTimeSeries = Mock()

    monkeypatch.setitem(sys.modules, "mozdetect", mozdetect)
    monkeypatch.setitem(sys.modules, "mozdetect.telemetry_query", telemetry_query)

    return mozdetect


@pytest.fixture
def central_repository(test_repository):
    """The repository telemetry alerting runs against."""
    test_repository.name = "mozilla-central"
    test_repository.save()
    return test_repository


@pytest.fixture
def telemetry_framework(transactional_db):
    return PerformanceFramework.objects.create(name="telemetry", enabled=True)


class TestGetProbeLabels:
    def test_unlabeled_probe_has_a_single_none_label(self, sherlock, base_metric_info):
        """Test unlabeled probes are analyzed once, without a label."""
        base_metric_info["data"]["monitor"] = True
        probe = TelemetryProbe(base_metric_info)

        assert sherlock._get_probe_labels(probe, "Windows", "mozdata") == [None]

    def test_labeled_probe_returns_queried_labels(
        self, sherlock, labeled_metric_info, fake_mozdetect
    ):
        """Test all the labels of a labeled probe are returned."""
        fake_mozdetect.telemetry_query.get_metric_labels.return_value = ["http", "https"]
        probe = TelemetryProbe(labeled_metric_info)

        labels = sherlock._get_probe_labels(probe, "Windows", "mozdata")

        assert labels == ["http", "https"]
        fake_mozdetect.telemetry_query.get_metric_labels.assert_called_once_with(
            probe.name, "Windows", project="mozdata"
        )

    def test_labeled_probe_with_label_filter(self, sherlock, labeled_metric_info, fake_mozdetect):
        """Test only the requested label is returned when a filter is given."""
        fake_mozdetect.telemetry_query.get_metric_labels.return_value = ["http", "https"]
        probe = TelemetryProbe(labeled_metric_info)

        labels = sherlock._get_probe_labels(probe, "Windows", "mozdata", label_filter="https")

        assert labels == ["https"]

    def test_labeled_probe_with_unknown_label_filter(
        self, sherlock, labeled_metric_info, fake_mozdetect
    ):
        """Test nothing is analyzed when the requested label doesn't exist."""
        fake_mozdetect.telemetry_query.get_metric_labels.return_value = ["http", "https"]
        probe = TelemetryProbe(labeled_metric_info)

        assert sherlock._get_probe_labels(probe, "Windows", "mozdata", label_filter="ftp") == []

    def test_labeled_probe_without_labels(
        self, sherlock, labeled_metric_info, fake_mozdetect, caplog
    ):
        """Test a labeled probe with no labels found is skipped."""
        probe = TelemetryProbe(labeled_metric_info)

        assert sherlock._get_probe_labels(probe, "Windows", "mozdata") == []
        assert f"No labels found for labeled probe {probe.name}" in caplog.text

    def test_labeled_probe_with_failing_label_query(
        self, sherlock, labeled_metric_info, fake_mozdetect, caplog
    ):
        """Test a failure while querying the labels doesn't break the run."""
        fake_mozdetect.telemetry_query.get_metric_labels.side_effect = Exception("BigQuery failed")
        probe = TelemetryProbe(labeled_metric_info)

        assert sherlock._get_probe_labels(probe, "Windows", "mozdata") == []
        assert f"Failed to get the labels of {probe.name}" in caplog.text

    def test_labeled_mobile_probe_is_skipped(
        self, sherlock, labeled_metric_info, fake_mozdetect, caplog
    ):
        """Test labeled mobile probes are skipped since their labels can't be queried."""
        labeled_metric_info["platform"] = "mobile"
        probe = TelemetryProbe(labeled_metric_info)

        assert sherlock._get_probe_labels(probe, "Android", "mozdata") == []
        assert f"Skipping labeled mobile probe {probe.name}" in caplog.text
        fake_mozdetect.telemetry_query.get_metric_labels.assert_not_called()


class TestTelemetryAlertWithLabeledProbes:
    def test_each_label_is_analyzed_separately(
        self,
        sherlock,
        labeled_metric_info,
        fake_mozdetect,
        central_repository,
        telemetry_framework,
        settings,
    ):
        """Test labeled probes get their own signature, and query, per label."""
        settings.TELEMETRY_ENABLE_ALERTS = True
        fake_mozdetect.telemetry_query.get_metric_labels.return_value = ["http", "https"]

        with patch.object(Sherlock, "_get_metric_definitions", return_value=[labeled_metric_info]):
            sherlock.telemetry_alert()

        signatures = PerformanceTelemetrySignature.objects.filter(
            probe=labeled_metric_info["name"]
        ).order_by("label")
        assert [signature.label for signature in signatures] == ["http", "https"]

        queried_labels = [
            call.kwargs["label"]
            for call in fake_mozdetect.telemetry_query.get_metric_table.call_args_list
        ]
        assert queried_labels == ["http", "https"]

    def test_unlabeled_probe_is_queried_without_a_label(
        self,
        sherlock,
        base_metric_info,
        fake_mozdetect,
        central_repository,
        telemetry_framework,
        settings,
    ):
        """Test unlabeled probes produce a single signature with no label."""
        settings.TELEMETRY_ENABLE_ALERTS = True
        base_metric_info["data"]["monitor"] = {"alert": False, "lower_is_better": True}

        with patch.object(Sherlock, "_get_metric_definitions", return_value=[base_metric_info]):
            sherlock.telemetry_alert()

        signature = PerformanceTelemetrySignature.objects.get(probe=base_metric_info["name"])
        assert signature.label == ""

        fake_mozdetect.telemetry_query.get_metric_labels.assert_not_called()
        assert fake_mozdetect.telemetry_query.get_metric_table.call_args.kwargs["label"] is None


class TestTelemetryAlertForceMonitor:
    def test_unmonitored_probe_is_skipped(
        self,
        sherlock,
        labeled_metric_info,
        fake_mozdetect,
        central_repository,
        telemetry_framework,
        settings,
    ):
        """Test probes without change detection enabled aren't analyzed."""
        settings.TELEMETRY_ENABLE_ALERTS = True
        labeled_metric_info["data"]["monitor"] = {}
        fake_mozdetect.telemetry_query.get_metric_labels.return_value = ["http", "https"]

        with patch.object(Sherlock, "_get_metric_definitions", return_value=[labeled_metric_info]):
            sherlock.telemetry_alert()

        assert not PerformanceTelemetrySignature.objects.exists()
        fake_mozdetect.telemetry_query.get_metric_table.assert_not_called()

    def test_unmonitored_probe_is_analyzed_when_forced(
        self,
        sherlock,
        labeled_metric_info,
        fake_mozdetect,
        central_repository,
        telemetry_framework,
        settings,
    ):
        """Test force_monitor analyzes probes that don't enable change detection."""
        settings.TELEMETRY_ENABLE_ALERTS = True
        labeled_metric_info["data"]["monitor"] = {}
        fake_mozdetect.telemetry_query.get_metric_labels.return_value = ["http", "https"]

        with patch.object(Sherlock, "_get_metric_definitions", return_value=[labeled_metric_info]):
            sherlock.telemetry_alert(force_monitor=True)

        signatures = PerformanceTelemetrySignature.objects.filter(
            probe=labeled_metric_info["name"]
        ).order_by("label")
        assert [signature.label for signature in signatures] == ["http", "https"]
        assert all(signature.lower_is_better for signature in signatures)
        assert fake_mozdetect.telemetry_query.get_metric_table.call_count == 2

    def test_forced_probe_emails_the_default_address(
        self,
        sherlock,
        labeled_metric_info,
        fake_mozdetect,
        central_repository,
        telemetry_framework,
        settings,
    ):
        """Test forced probes only produce emails, and never to the probe owners."""
        settings.TELEMETRY_ENABLE_ALERTS = True
        labeled_metric_info["data"]["monitor"] = {}
        analyzed_probes = []

        def capture_probe(probe, *args, **kwargs):
            analyzed_probes.append(probe)
            return []

        with (
            patch.object(Sherlock, "_get_metric_definitions", return_value=[labeled_metric_info]),
            patch.object(Sherlock, "_get_probe_labels", side_effect=capture_probe),
        ):
            sherlock.telemetry_alert(force_monitor=True)

        probe = analyzed_probes[0]
        assert probe.should_detect_changes() is True
        assert probe.should_file_bug() is False
        assert probe.get_notification_emails() == [DEFAULT_ALERT_EMAIL]
