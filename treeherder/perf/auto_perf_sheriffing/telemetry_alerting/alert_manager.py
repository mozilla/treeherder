import logging
import traceback

from treeherder.perf.auto_perf_sheriffing.base_alert_manager import AlertManager
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert import (
    TelemetryAlertFactory,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.alert_modifier import (
    TelemetryAlertModifier,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_manager import (
    TelemetryBugManager,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.bug_modifier import (
    TelemetryBugModifier,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.email_manager import (
    TelemetryEmailManager,
)
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    EMAIL_LIMIT,
    MODIFIABLE_ALERT_FIELDS,
)
from treeherder.perf.models import (
    PerformanceTelemetryAlert,
    PerformanceTelemetryAlertSummary,
)

logger = logging.getLogger(__name__)


class TelemetryAlertManager(AlertManager):
    """Alert Management for Telemetry Alerts."""

    def __init__(self, probes):
        super().__init__(TelemetryBugManager(), TelemetryEmailManager())
        self.probes = probes
        self._emails_made = 0

    def _emails_left(self):
        return max(0, EMAIL_LIMIT - self._emails_made)

    def _email_made(self):
        self._emails_made += 1

    def _get_probe_info(self, probe_name):
        probe = self.probes.get(probe_name)
        if not probe:
            raise Exception(f"Unknown probe alerted. No information known about it: {probe_name}")
        return probe

    def comment_alert_bugs(self, alerts):
        """Comments on bugs to mention additional alerting probes.

        Telemetry alerting doesn't currently have any commenting behaviour.
        Associations between related alerts will be done through the modify_alerts
        method, and the "See Also" Bugzilla field.
        """
        pass

    def update_alerts(self, alerts):
        """Updates all alerts with status changes from the associated bugs.

        Queries bugzilla for all telemetry-alert bugs, then goes through the
        PerformanceTelemetryAlertSummary objects to update those that changed.

        An alternative is to go through every telemetry alert in the DB, however
        that results in many more network requests. However, this approach involves
        more DB queries.
        """
        alert_updates, alerts_with_updates = TelemetryAlertModifier.get_alert_updates(alerts)
        if not alert_updates:
            return

        alerts_to_update = set()
        fields_to_update = set()
        for alert_id, alert in alerts_with_updates.items():
            updates = alert_updates[alert_id]
            for updated_field, updated_value in updates.items():
                if updated_field not in MODIFIABLE_ALERT_FIELDS:
                    continue
                alerts_to_update.add(alert)
                fields_to_update.add(updated_field)

                setattr(alert, updated_field, updated_value)

        logger.info(
            f"Updating the following alert IDs for changes in Bugzilla fields `"
            f"{', '.join(fields_to_update)}`: "
            f"{', '.join([str(alert.id) for alert in alerts_to_update])}"
        )
        num_updated = PerformanceTelemetryAlert.objects.bulk_update(
            list(alerts_to_update), list(fields_to_update)
        )
        logger.info(f"{num_updated} alerts updated with changes")

    def modify_alert_bugs(self, alerts, commented_bugs, new_bugs):
        """Modifies the alert bugs.

        Modifies existing telemetry alert bugs with new bugs that alerted on
        the same day. It adds these bugs to the "See Also" field for the other bugs.
        """
        for bug, changes in TelemetryBugModifier.get_bug_modifications(
            alerts, commented_bugs, new_bugs
        ).items():
            # Fields like "see_also" are treated as group modifiers that affect
            # groupings of bugs that are related to the PerformanceTelemetryAlertSummary

            bug_alert = None
            for alert in alerts:
                if str(alert.telemetry_alert.bug_number) == str(bug):
                    bug_alert = alert

            try:
                self.bug_manager.modify_bug(bug, changes)
                logger.info(f"Made modifications to telemetry alert bug {bug}")

                bug_alert.telemetry_alert_summary.bugs_modified = True
                bug_alert.telemetry_alert.bug_modified = True
            except Exception:
                logger.warning(f"Failed to modify bug {bug}: {traceback.format_exc()}")

                bug_alert.failed = True
                if "see_also" in changes:
                    bug_alert.telemetry_alert_summary.bugs_modified = False
                else:
                    bug_alert.telemetry_alert.bug_modified = False
            finally:
                bug_alert.telemetry_alert_summary.save()
                bug_alert.telemetry_alert.save()

    def __should_file_bug(self, probe, alert):
        """Ensure that the alert should have a bug filed.

        Current criteria for bug filling are:
            (1) Monitor field must be defined (already checked by this point).
            (2) Monitor field is set to an object, AND the alert field is
                set to True.
            (3) Alert does not already have a bug filed for it.
        """
        return probe.should_file_bug() and not alert.telemetry_alert.bug_number and not alert.failed

    def _file_alert_bug(self, alert):
        """Files a bug for each telemetry alert summary.

        Only produced for telemetry alert summaries without a bug number. Those
        with a bug number are handled by comment_alert_bugs.
        """
        try:
            probe = self._get_probe_info(alert.telemetry_signature.probe)
            if not self.__should_file_bug(probe, alert):
                return

            # File a bug
            bug_info = self.bug_manager.file_bug(probe, alert)

            # Associate it with the alert
            alert.telemetry_alert.bug_number = int(bug_info["id"])
            alert.telemetry_alert.save()

            return bug_info["id"]
        except Exception:
            # If we fail to create a bug, output the warning and delete the alert
            # so that we can regenerate it and try again another time
            logger.warning(f"Failed to create alert bug for {alert}: {traceback.format_exc()}")
            alert.telemetry_alert.delete()
            alert.failed = True

    def __should_notify(self, probe, alert):
        """Ensure that the alert should produce notifications.

        Current criteria for notifications are:
            (1) Monitor field must be defined (already checked by this point).
            (2) Monitor field is set to True OR monitor field is set to
                an object with alert set to False.
            (3) Bug has not been filed for the alert.
        """
        return probe.should_email() and not alert.telemetry_alert.bug_number and not alert.failed

    def _email_alert(self, alert):
        """Sends out emails for each new alert.

        Each probe that alerted will have an email sent out to all alert notification
        emails. This means that if a telemetry alert summary (a grouping of alerts)
        contains multiple probes that alert, each of those probes will have an email
        sent out.
        """
        if self._emails_left() <= 0:
            return

        try:
            probe = self._get_probe_info(alert.telemetry_signature.probe)
            if not self.__should_notify(probe, alert):
                return

            # Send notification emails for the alert
            self.email_manager.email_alert(probe, alert)
            self._email_made()
            logger.info(f"Created email notification for {alert}")

            # Set the alert to notified
            alert.telemetry_alert.notified = True
        except Exception:
            logger.warning(f"Failed to create alert email for {alert}: {traceback.format_exc()}")
            alert.telemetry_alert.notified = False
        finally:
            alert.telemetry_alert.save()

    def _redo_email_alerts(self):
        """Handles re-running emails for alerts that don't have any."""
        logger.info("House keeping: retrying emails for alerts")

        # Limit to 50 emails due to fxci email rate limit
        alerts_no_emails = PerformanceTelemetryAlert.objects.filter(
            notified=False, bug_number__isnull=True
        )[:self._emails_left()]

        for alert_row in alerts_no_emails:
            alert_no_email = TelemetryAlertFactory.construct_alert(alert_row)
            self._email_alert(alert_no_email)

    def _redo_bug_modifications(self):
        """Handles retrying any bug modifications that are missing because of failures."""
        logger.info("House keeping: retrying bug modifications")
        alert_summaries_not_modified = PerformanceTelemetryAlertSummary.objects.filter(
            bugs_modified=False
        )
        alerts_not_modified = PerformanceTelemetryAlert.objects.filter(
            summary_id__in=[summary.id for summary in alert_summaries_not_modified]
        )

        alerts = []
        for alert_row in alerts_not_modified:
            alerts.append(TelemetryAlertFactory.construct_alert(alert_row))

        self.modify_alert_bugs(alerts, [], [])

    def house_keeping(self, alerts, commented_bugs, new_bugs):
        """General maintenance of the telemetry alert tables."""
        logger.info("Performing house keeping")
        self._redo_email_alerts()
        self._redo_bug_modifications()
        logger.info("Completed house keeping")
