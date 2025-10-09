import logging
from datetime import timedelta

from treeherder.perf.auto_perf_sheriffing.bug_searcher import BugSearcher
from treeherder.perf.auto_perf_sheriffing.telemetry_alerting.utils import (
    MODIFIABLE_ALERT_FIELDS,
)
from treeherder.perf.models import PerformanceTelemetryAlert

logger = logging.getLogger(__name__)


class TelemetryAlertModifier:
    updaters = []

    @staticmethod
    def add(updater_class):
        TelemetryAlertModifier.updaters.append(updater_class)

    @staticmethod
    def get_updaters():
        return TelemetryAlertModifier.updaters

    @staticmethod
    def get_alert_updates(alerts, *args, **kwargs):
        """Runs all the updaters to get alert updates.

        No guarantees on the ordering of the updaters running are made. They
        should each be responsible for updating only 1 specific thing, e.g.
        one updater for the resolution, etc..

        Alert updates are gathered and a batch update is performed to update all
        the alerts in the DB at the same time.

        Alert updaters are expected to produce a dictionary in the following format:
        {
            "alert-id": {
                "change-field": <NEW-VALUE>,
                "change-field2": <NEW-VALUE>,
                ...
            },
            "alert-id2": {
                "change-field": <NEW-VALUE>,
                ...
            },
            ...
        }

        Warnings will be raised when an updater is found to be modify a field that
        was already modified. The merge will continue but it will ignore the additional
        change to ensure that other alert updates can still be made.
        """
        all_updates = {}
        for updater in TelemetryAlertModifier.get_updaters():
            updates = updater.update_alerts(**kwargs)
            if not updates:
                continue
            for alert, alert_updates in updates.items():
                all_updates.setdefault(str(alert), []).append(alert_updates)
        return TelemetryAlertModifier._merge_updates(all_updates)

    @staticmethod
    def _merge_updates(all_updates):
        """Merges all the updates that will be made by updaters.

        No field modifications can be combined so warnings will be raised on any alerts
        that have the same field being modified.
        """
        merged_updates = {}
        for alert, updates in all_updates.items():
            alert_updates = merged_updates.setdefault(alert, {})
            for update in updates:
                for field, value in update.items():
                    if field in alert_updates:
                        logger.warning(
                            f"Multiple modifications found for alert ID {alert} field "
                            f"{field}. Values found: {value}, and {alert_updates[field]}"
                        )
                        continue
                    if field not in MODIFIABLE_ALERT_FIELDS:
                        logger.warning(f"Model field {field} is not set as a modifiable field.")
                        continue
                    alert_updates[field] = value
        return merged_updates


@TelemetryAlertModifier.add
class ResolutionModifier:
    @staticmethod
    def update_alerts(**kwargs):
        """Get resolution updates for existing alerts in the DB."""
        bug_searcher = BugSearcher()

        start_date = bug_searcher.get_today_date() - timedelta(7)

        bug_searcher.set_include_fields(["id", "resolution"])
        bug_searcher.set_query(
            {
                "f1": "keywords",
                "o1": "anywords",
                "v1": "telemetry-alert",
                "f2": "resolution",
                "f4": "resolution",
                "o4": "changedafter",
                "v4": start_date,
            }
        )

        try:
            bugs = bug_searcher.get_bugs()
        except Exception as e:
            logger.warning(f"Failed to get bugs for alert resolution updates: {str(e)}")
            return

        alerts_to_update = PerformanceTelemetryAlert.objects.filter(
            bug_number__in=[bug_info["id"] for bug_info in bugs["bugs"]]
        )

        def __get_alert_status(bug_number):
            for bug in bugs.get("bugs", []):
                if bug["id"] != bug_number:
                    continue
                status = bug["resolution"]
                for status_index, status_choice in PerformanceTelemetryAlert.STATUSES:
                    if status == status_choice:
                        return status_index

        updates = {}
        for alert in alerts_to_update:
            bug_status = __get_alert_status(alert.bug_number)
            if bug_status:
                updates[str(alert.id)] = {"status": bug_status}

        return updates
