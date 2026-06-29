from treeherder.perf.auto_perf_sheriffing.base_email_manager import EmailManager
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    TELEMETRY_ALERT_DASHBOARD_ALERT,
    TELEMETRY_ALERT_DASHBOARD_SUMMARY,
    get_glean_dictionary_link,
    get_treeherder_detection_link,
    get_treeherder_detection_range_link,
)
from treeherder.perf.email import EmailWriter


class TelemetryEmailManager(EmailManager):
    """Formats and emails alert notifications."""

    def email_alert(self, probe, alert):
        telemetry_email = TelemetryEmail(self.get_notify_func())

        for email in probe.get_notification_emails():
            telemetry_email.email(email, probe, alert)


class TelemetryEmail:
    """Adapter for the email producers."""

    def __init__(self, email_func):
        self.email_writer = TelemetryEmailWriter()
        self.email_client = None
        self._set_email_method(email_func)

    def email(self, *args, **kwargs):
        # Email through Taskcluster client
        self.email_func(self._prepare_email(*args, **kwargs))

    def _set_email_method(self, func):
        self.email_func = func

    def _prepare_email(self, *args, **kwargs):
        return self.email_writer.prepare_email(*args, **kwargs)


class TelemetryEmailWriter(EmailWriter):
    def prepare_email(self, email, probe, alert, **kwargs):
        self._write_address(email)
        self._write_subject(probe)
        self._write_content(probe, alert)

        return self.email

    def _write_address(self, email):
        self._email.address = email

    def _write_subject(self, probe):
        self._email.subject = f"Telemetry Alert for Probe {probe.name}"

    def _write_content(self, probe, alert):
        content = TelemetryEmailContent()
        content.write_email(probe, alert)
        self._email.content = str(content)


def format_header(header_name):
    """Format email header names to improve column spacing.

    The taskcluster email service condenses the columns far too much
    so this method helps that situation by replacing spaces with "&nbsp;"
    in the header names to prevent the headers from being split into multiple
    rows. It also adds an additional 4 of these at the end of the header names
    """
    return header_name.replace(" ", "&nbsp;") + "&nbsp;" * 4


class TelemetryEmailContent:
    DESCRIPTION = (
        "MozDetect has detected a telemetry change in a probe you are subscribed to:\n---\n"
    )

    TABLE_HEADERS = (
        f"| {format_header('Channel')} | {format_header('Probe')} | {format_header('Platform')} "
        f"| {format_header('Date Range')} | {format_header('Detection Push')} "
        f"| {format_header('Alert Details')} |\n"
        f"| :---: | :---: | :---: | :---: | :---: | :---: |\n"
    )

    ADDITIONAL_PROBES = (
        "See below for additional probes that alerted at the same time (or near "
        "the same push):"
        "\n---\n"
    )

    DASHBOARD_SECTION = (
        "\n---\n**[View the alert summary on the Telemetry Alert Dashboard.]({url})**\n"
    )

    def __init__(self):
        self._raw_content = None

    def write_email(self, probe, alert):
        self._initialize_report_intro()
        self._include_probe(
            alert.get_detection_range(),
            alert.telemetry_signature,
            alert.telemetry_alert_summary,
            alert.telemetry_alert.id,
        )

        if alert.get_related_alerts():
            self._include_additional_probes(alert)

        self._include_dashboard_link(alert.telemetry_alert_summary.id)

    def _initialize_report_intro(self):
        if self._raw_content is None:
            self._raw_content = self.DESCRIPTION + self.TABLE_HEADERS

    def _include_probe(
        self, detection_range, telemetry_signature, telemetry_alert_summary, alert_id
    ):
        new_table_row = self._build_table_row(
            detection_range, telemetry_signature, telemetry_alert_summary, alert_id
        )
        self._raw_content += f"{new_table_row}\n"

    def _include_dashboard_link(self, summary_id):
        self._raw_content += self.DASHBOARD_SECTION.format(
            url=TELEMETRY_ALERT_DASHBOARD_SUMMARY.format(summary_id=summary_id)
        )

    def _include_additional_probes(self, alert):
        self._raw_content += f"\n{self.ADDITIONAL_PROBES}{self.TABLE_HEADERS}"
        for related_alert in alert.get_related_alerts():
            self._include_probe(
                alert.get_detection_range(),
                related_alert.series_signature,
                alert.telemetry_alert_summary,
                related_alert.id,
            )

    def _build_table_row(
        self, detection_range, telemetry_signature, telemetry_alert_summary, alert_id
    ) -> str:
        # TODO: Have change-detection-technique/mozdetect provide a method for building
        # a row. That way we can decouple the information provided to bugzilla
        # users from the alerting system.
        return (
            "| {channel} | [{probe}]({glean_dictionary_link})&nbsp;&nbsp;&nbsp;&nbsp; | {platform} "
            "| [{date_from} - {date_to}]({treeherder_date_link})"
            "| [{commit_hash}]({treeherder_push_link}) "
            "| [{alert_id}]({alert_details_link}) |"
        ).format(
            channel=telemetry_signature.channel,
            probe=telemetry_signature.probe,
            glean_dictionary_link=get_glean_dictionary_link(telemetry_signature),
            platform=telemetry_signature.platform,
            date_from=detection_range["from"].time.strftime("%Y-%m-%d"),
            date_to=detection_range["to"].time.strftime("%Y-%m-%d"),
            commit_hash=detection_range["detection"].revision[:12],
            treeherder_date_link=get_treeherder_detection_range_link(
                detection_range, telemetry_signature
            ),
            treeherder_push_link=get_treeherder_detection_link(
                detection_range, telemetry_signature
            ),
            alert_id=alert_id,
            alert_details_link=TELEMETRY_ALERT_DASHBOARD_ALERT.format(alert_id=alert_id),
        )

    def __str__(self):
        if self._raw_content is None:
            raise ValueError("No content set")
        return self._raw_content
