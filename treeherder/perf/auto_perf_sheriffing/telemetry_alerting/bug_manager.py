import logging
from datetime import timedelta

from treeherder.perf.auto_perf_sheriffing.base_bug_manager import BugManager
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    PUSH_LOG,
    TELEMETRY_ALERT_DASHBOARD,
    get_glean_dictionary_link,
    get_treeherder_detection_link,
    get_treeherder_detection_range_link,
)

logger = logging.getLogger(__name__)


class TelemetryBugManager(BugManager):
    """Files bugs, and comments on them for telemetry alerts."""

    def __init__(self):
        super().__init__()

    def file_bug(self, probe, alert):
        logger.info(f"Filing bug for alert on probe {probe.name}")
        bug_data = self._get_default_bug_creation_data()
        bug_content = TelemetryBugContent().build_bug_content(probe, alert)

        bug_data["summary"] = bug_content["title"]
        bug_data["description"] = bug_content["description"]

        # For testing use Testing :: Performance, later switch to
        # using tags from metrics_info
        bug_data["product"] = "Testing"
        bug_data["component"] = "Performance"

        bug_data["severity"] = "S4"
        bug_data["priority"] = "P5"
        bug_data["keywords"] = "telemetry-alert,regression"

        # Only set a needinfo on the first email in the notification list
        needinfo_emails = probe.get_notification_emails()
        self._add_needinfo(needinfo_emails[0], bug_data)

        bug_info = self._create(bug_data)
        logger.info(f"Filed bug {bug_info['id']}")

        return bug_info

    def modify_bug(self, bug, changes):
        logger.info(f"Making modifications to bug {bug}")
        resp = self._modify(bug, changes)
        print(resp)
        logger.info(f"Finished modifying bug {bug}")

    def comment_bug(self, alert):
        pass


class TelemetryBugContent:
    """Formats the content of a bug.

    Used for producing the first comment of a bug (description, or comment #0),
    and for producing comments after an initial bug is created.
    """

    BUG_DESCRIPTION = (
        "MozDetect has detected changes in the following telemetry probes on "
        "builds from [{date}]({detection_push_link}). As the probe owner of the "
        "following probes, we need your help to address this regression and "
        "find a culprit."
        "\n\n{change_table}\n"
        "[See these Treeherder pushes for possible culprits for this detected change]"
        "({detection_range_link}).\n\n"
        "[A push log can be found here for a quicker overview of the changes that"
        "occurred around this change]({push_log_link}).\n\n"
        "For more information on how to handle these probe changes, and "
        "what the various columns mean [see here]"
        "(https://firefox-source-docs.mozilla.org/testing/perfdocs/telemetry-alerting.html).\n\n"
        "Note that it's possible the culprit is from a commit in the day before, "
        "or the day after these push logs. It's also possible that these culprits "
        "are not the cause, and the change could be coming from a popular "
        "website. Please reach out to the Performance team if you suspect this to be "
        "the case in [#perf on Matrix](https://matrix.to/#/#perf:mozilla.org), or "
        "[#perf-help on Slack](https://mozilla.enterprise.slack.com/archives/C03U19JCSFQ)."
        "\n\n"
        "[See here for other probes that alerted on, or around, the same push]({telemetry_alert_dashboard})."
    )

    BUG_COMMENT = (
        "MozDetect has detected changes in additional probes on the same date "
        "which may be related to the changes the bug was originally filed for."
        "\n\n{change_table}"
    )

    TABLE_HEADERS = (
        "| **Probe** | **Platform** "
        "| **Previous Values** | **New Values** |\n"
        "| :---: | :---: | :---: | :---: |\n"
    )

    CHANGES_DETECTED_TITLE = "### Changes Detected\n"

    BUG_TITLE = "Telemetry Alert for {probe} on {date}"

    def build_bug_content(self, probe, alert):
        bug_content = {"title": "", "description": ""}

        detection_range = alert.get_detection_range()
        detection_date = detection_range["detection"].time.strftime("%Y-%m-%d")

        # End date is exclusive so we need to add 1 day to it
        start_date = detection_range["from"].time.strftime("%Y-%m-%d")
        end_date = (detection_range["to"].time + timedelta(days=1)).strftime("%Y-%m-%d")

        bug_content["title"] = self.BUG_TITLE.format(
            probe=alert.telemetry_signature.probe, date=detection_date
        )

        bug_content["description"] = self.BUG_DESCRIPTION.format(
            date=detection_date,
            detection_push_link=get_treeherder_detection_link(
                detection_range, alert.telemetry_signature
            ),
            change_table=self._build_change_table(probe, alert),
            detection_range_link=get_treeherder_detection_range_link(
                detection_range, alert.telemetry_signature
            ),
            push_log_link=PUSH_LOG.format(start_date=start_date, end_date=end_date),
            telemetry_alert_dashboard=TELEMETRY_ALERT_DASHBOARD.format(
                alert_summary_id=alert.telemetry_alert_summary.id
            ),
        )

        return bug_content

    def build_comment_content(self, alert):
        pass

    def _build_change_table(self, probe, alert):
        change_table = self.CHANGES_DETECTED_TITLE
        change_table += self._get_detection_warnings(alert)
        change_table += self.TABLE_HEADERS + self._build_probe_alert_row(probe, alert)
        return change_table

    def _get_detection_warnings(self, alert):
        """Get any warnings about the detection that should be displayed."""
        warnings = self._get_sample_difference_warning(alert)
        return warnings

    def _get_sample_difference_warning(self, alert):
        """Check if sample size changed significantly (>=20%) and return a warning if so."""
        prev_samples = alert.telemetry_alert.prev_value
        new_samples = alert.telemetry_alert.new_value

        if prev_samples > 0:
            sample_diff_pct = abs((new_samples - prev_samples) / prev_samples * 100)
            if sample_diff_pct >= 20:
                return (
                    f"\n**Warning: The number of samples changed by {sample_diff_pct:.1f}% "
                    f"(from {int(prev_samples)} to {int(new_samples)}). "
                    f"This may affect the reliability of the detection.**\n\n"
                )

        return ""

    def _normalize_time_unit(self, unit):
        """Convert full time unit names to shorthand notation."""
        unit_mapping = {
            "nanosecond": "ns",
            "microsecond": "us",
            "millisecond": "ms",
            "second": "s",
        }

        # Normalize to lowercase and return mapped value if it's a full name
        normalized = unit.lower() if unit else ""
        return unit_mapping.get(normalized, normalized)

    def _convert_from_nanoseconds(self, value_ns, unit):
        """Convert a value from nanoseconds to the specified unit."""
        conversion_factors = {
            "ns": 1,
            "us": 1_000,
            "ms": 1_000_000,
            "s": 1_000_000_000,
        }

        return value_ns / conversion_factors.get(unit, 1)

    def _build_probe_alert_row(self, probe, alert):
        # TODO: Have change-detection-technique/mozdetect provide a method for building
        # a row. That way we can decouple the information provided to bugzilla
        # users from the alerting system.

        # Normalize unit to shorthand for both conversion and display
        unit = self._normalize_time_unit(probe.time_unit)

        # Convert values from nanoseconds to the appropriate unit
        prev_median = self._convert_from_nanoseconds(alert.telemetry_alert.prev_median, unit)
        new_median = self._convert_from_nanoseconds(alert.telemetry_alert.new_median, unit)
        prev_p05 = self._convert_from_nanoseconds(alert.telemetry_alert.prev_p05, unit)
        new_p05 = self._convert_from_nanoseconds(alert.telemetry_alert.new_p05, unit)
        prev_p95 = self._convert_from_nanoseconds(alert.telemetry_alert.prev_p95, unit)
        new_p95 = self._convert_from_nanoseconds(alert.telemetry_alert.new_p95, unit)

        values = (
            f"| **Median:** {round(prev_median, 2)}{unit} "
            f"| **Median:** {round(new_median, 2)}{unit} |\n"
            f"| | | | **P05:** {round(prev_p05, 2)}{unit} "
            f"| **P05:** {round(new_p05, 2)}{unit} |\n"
            f"| | | | **P95:** {round(prev_p95, 2)}{unit} "
            f"| **P95:** {round(new_p95, 2)}{unit} |"
        )

        return (
            f"| [{alert.telemetry_signature.probe}]({get_glean_dictionary_link(alert.telemetry_signature)}) "
            f"| {alert.telemetry_signature.platform} {values} \n"
        )
