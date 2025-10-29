import logging
import traceback

logger = logging.getLogger(__name__)


class Alert:
    def __init__(self):
        self._failed = False

    @property
    def failed(self):
        return self._failed

    @failed.setter
    def failed(self, value):
        self._failed = value


class AlertManager:
    """Handles the alert management.

    This includes the following:
        (1) Filing bugs
        (2) Setting status for the alerts when bugs are updated
        (3) Adding comments to bugs for addition alerts when they are produced
            after the bug was.
    """

    def __init__(self, bug_manager, email_manager):
        self.bug_manager = bug_manager
        self.email_manager = email_manager

    def manage_alerts(self, alerts, *args, **kwargs):
        """Handles everything related to alert notifications.

        None of these depend on each other, so a failure in one doesn't always
        mean that a failure in another one will happen.
        """
        try:
            # Update alerts with bug info. Done before filing new bugs
            # to prevent updating from recently filed bugs.
            self.update_alerts(alerts, *args, **kwargs)
        except Exception:
            logger.info(f"Failed to update alerts: {traceback.format_exc()}")

        commented_bugs = []
        try:
            # Comment on existing bugs. Done before filing new bugs to
            # prevent commenting on recently filed bugs
            commented_bugs = self.comment_alert_bugs(alerts, *args, **kwargs)
        except Exception:
            logger.warning(f"Failed to comment on existing bugs: {traceback.format_exc()}")

        new_bugs = []
        try:
            # File new bugs
            new_bugs = self.file_alert_bugs(alerts, *args, **kwargs)
        except Exception:
            logger.warning(f"Failed to file alert bugs: {traceback.format_exc()}")

        try:
            # Modify any of the bugs that were commented on, or created. Exclude
            # alerts that were marked as failures when creating bugs.
            alerts = [alert for alert in alerts if not alert.failed]
            self.modify_alert_bugs(alerts, commented_bugs, new_bugs, *args, **kwargs)
        except Exception:
            logger.warning(f"Failed to file alert bugs: {traceback.format_exc()}")

        try:
            # Produce email notifications. Done after filing bugs to include
            # bug information if that becomes a feature at some point.
            self.email_alerts(alerts, *args, **kwargs)
        except Exception:
            logger.warning(f"Failed to send email alerts: {traceback.format_exc()}")

        try:
            # Final stage to let us do any necessary cleanup/houskeeping/etc. from
            # this current run or previous runs. Can include general maintenance of
            # alerts and tables.
            self.house_keeping(alerts, commented_bugs, new_bugs, *args, **kwargs)
        except Exception:
            logger.warning(f"Failed to perform house keeping: {traceback.format_exc()}")

    def update_alerts(self, *args, **kwargs):
        """Updates all alerts with status changes from the associated bugs."""
        raise NotImplementedError()

    def comment_alert_bugs(self, alerts, *args, **kwargs):
        """Comments on bugs to mention additional alerting measurements."""
        raise NotImplementedError()

    def file_alert_bugs(self, alerts, *args, **kwargs):
        """Files a bug for each telemetry alert summary."""
        bugs = []

        for alert in alerts:
            bug = self._file_alert_bug(alert, *args, **kwargs)
            if bug is None:
                continue
            bugs.append(bug)

        return bugs

    def _file_alert_bug(self, *args, **kwargs):
        """Create a bug for an alert."""
        raise NotImplementedError()

    def modify_alert_bugs(self, alerts, commented_bugs, new_bugs, *args, **kwargs):
        """Modify alert bugs."""
        raise NotImplementedError()

    def email_alerts(self, alerts, *args, **kwargs):
        """Sends out emails for each new alert."""
        for alert in alerts:
            self._email_alert(alert, *args, **kwargs)

    def _email_alert(self, *args, **kwargs):
        """Produces an email for a new telemetry alert summary."""
        raise NotImplementedError()

    def house_keeping(self, alerts, commented_bugs, new_bugs, *args, **kwargs):
        """Used for any sort of general maintenance/cleanup/etc.."""
        raise NotImplementedError()
