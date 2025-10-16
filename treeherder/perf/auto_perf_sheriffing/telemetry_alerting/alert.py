from treeherder.perf.auto_perf_sheriffing.base_alert_manager import Alert
from treeherder.perf.models import PerformanceTelemetryAlert


class TelemetryAlertBuildError(Exception):
    """Generating when the TelemetryFactory cannot build the alerts requested."""

    pass


class TelemetryAlert(Alert):
    def __init__(self, telemetry_alert, telemetry_alert_summary, telemetry_signature):
        super().__init__()
        self.telemetry_alert = telemetry_alert
        self.telemetry_alert_summary = telemetry_alert_summary
        self.telemetry_signature = telemetry_signature
        self.related_telemetry_alerts = None
        self.detection_range = None

    def get_related_alerts(self):
        if self.related_telemetry_alerts:
            return self.related_telemetry_alerts

        self.related_telemetry_alerts = PerformanceTelemetryAlert.objects.filter(
            summary_id=self.telemetry_alert_summary.id
        ).exclude(id=self.telemetry_alert.id)

        return self.related_telemetry_alerts

    def get_detection_range(self):
        if self.detection_range:
            return self.detection_range

        self.detection_range = {
            "from": self.telemetry_alert_summary.prev_push,
            "to": self.telemetry_alert_summary.push,
            "detection": self.telemetry_alert_summary.original_push,
        }

        return self.detection_range

    def __str__(self):
        return (
            f"TelemetryAlert<alertID={self.telemetry_alert.id}, "
            f"alertSummaryID={self.telemetry_alert_summary.id}, "
            f"probe={self.telemetry_signature.probe}, "
            f"platform={self.telemetry_signature.platform}>"
        )


class TelemetryAlertFactory:
    """Provides a single interface for building TelemetryAlerts.

    Currently only builds a single alert at a time, but this could be changed
    in the future to build a large number of alerts given some input.
    """

    @staticmethod
    def _build_alert(telemetry_alert, telemetry_alert_summary, telemetry_signature):
        return TelemetryAlert(telemetry_alert, telemetry_alert_summary, telemetry_signature)

    @staticmethod
    def _build_alert_from_row(telemetry_alert):
        telemetry_signature = telemetry_alert.series_signature
        telemetry_alert_summary = telemetry_alert.summary

        return TelemetryAlert(telemetry_alert, telemetry_alert_summary, telemetry_signature)

    @staticmethod
    def construct_alert(
        telemetry_alert=None,
        telemetry_alert_summary=None,
        telemetry_signature=None,
    ):
        if (
            telemetry_alert is not None
            and telemetry_alert_summary is not None
            and telemetry_signature is not None
        ):
            return TelemetryAlertFactory._build_alert(
                telemetry_alert, telemetry_alert_summary, telemetry_signature
            )
        elif telemetry_alert is not None:
            return TelemetryAlertFactory._build_alert_from_row(telemetry_alert)

        raise TelemetryAlertBuildError("Could not construct TelemetryAlerts from given arguments")
