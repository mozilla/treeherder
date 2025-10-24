import logging
import traceback

import requests

from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    DEFAULT_ALERT_EMAIL,
    DEFAULT_CHANGE_DETECTION,
    GLEAN_PROBE_INFO,
)

logger = logging.getLogger(__name__)

ALERTING_PROBES = (
    "networking_http_channel_page_open_to_first_sent",
    "perf_largest_contentful_paint",
)


class TelemetryProbeValidationError(Exception):
    """Raised when a probes information is incorrect, or missing."""

    def __init__(self, name, message):
        super().__init__(f"Probe {name}: {message}")


class TelemetryProbe:
    def __init__(self, metric_info):
        self.metric_info = metric_info
        self.name = self.metric_info["name"]
        self._should_file_bug = None
        self._should_email = None

        self.monitor_info = self.metric_info["data"].get("monitor")
        if self.monitor_info["detect_changes"]:
            self.verify_probe_definition()
            self.should_file_bug()
            self.should_email()

    @property
    def monitor_info(self):
        return self._monitor_info

    @monitor_info.setter
    def monitor_info(self, monitor_info):
        self._monitor_info = {}
        if isinstance(monitor_info, bool):
            self._monitor_info["detect_changes"] = monitor_info
        elif isinstance(monitor_info, dict) and monitor_info:
            self._monitor_info["detect_changes"] = True
            self._monitor_info.update(monitor_info)
        elif monitor_info is None or (isinstance(monitor_info, dict) and not monitor_info):
            self._monitor_info["detect_changes"] = False
        else:
            raise TelemetryProbeValidationError(
                self.name,
                f"`monitor` field must by either a boolean or dictionary. "
                f"Found: {type(monitor_info)}",
            )

    def get_change_detection_technique(self):
        return self.monitor_info.get("change-detection-technique", DEFAULT_CHANGE_DETECTION)

    def should_file_bug(self):
        # Only file bugs when alert is set to True
        return self.monitor_info.get("alert", False)

    def should_email(self):
        # Only produce emails when alert is undefined or set to False
        return not self.monitor_info.get("alert", False)

    def should_detect_changes(self):
        return self.monitor_info.get("detect_changes", False)

    def get_notification_emails(self, default=DEFAULT_ALERT_EMAIL):
        self.setup_notification_emails(default=default)
        return self.monitor_info.get(
            "bugzilla_notification_emails", self.monitor_info.get("notification_emails", [default])
        )

    def setup_notification_emails(self, default=DEFAULT_ALERT_EMAIL):
        # These emails are only obtained when we have an alert that we need to
        # produce an email for. They are also only obtained if notification emails
        # aren't already found in some fields.
        if self.monitor_info.get("bugzilla_notification_emails", None) or self.monitor_info.get(
            "notification_emails", None
        ):
            return

        # XXX: Remove once prototyping is complete
        if self.name not in ALERTING_PROBES:
            self.monitor_info["notification_emails"] = [default]
            return

        try:
            url = GLEAN_PROBE_INFO.format(probe_name=self.name)
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            self.monitor_info["notification_emails"] = data["notification_emails"]
        except Exception:
            logger.warning(
                f"Failed to obtain notification emails for probe {self.name}: "
                f"{traceback.format_exc()}"
            )
            self.monitor_info["notification_emails"] = [default]

    def verify_probe_definition(self):
        if self.monitor_info.get("alert", False) and not self.monitor_info.get(
            "bugzilla_notification_emails"
        ):
            # This probe will produce bugs, so it needs to have the
            # bugzilla_notification_emails set
            raise TelemetryProbeValidationError(
                self.name,
                "`bugzilla_notification_emails` must be set to valid Bugzilla account "
                "emails when a probe is set to produce alerts.",
            )
