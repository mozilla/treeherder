import logging

from treeherder.perf.auto_perf_sheriffing.base_alert_manager import AlertManager
from treeherder.perf.auto_perf_sheriffing.performance_alerting.alert_modifier import (
    PerformanceAlertSummaryModifier,
)
from treeherder.perf.models import PerformanceAlertSummary

MODIFIABLE_ALERT_SUMMARY_FIELDS = ("bug_status",)

logger = logging.getLogger(__name__)


class PerformanceAlertManager(AlertManager):
    def __init__(self):
        super().__init__(bug_manager=None, email_manager=None)

    def update_alerts(self, alerts, *args, **kwargs):
        alert_updates, summaries_with_updates = (
            PerformanceAlertSummaryModifier.get_alert_summary_updates()
        )
        if not alert_updates:
            return

        summaries_to_update = set()
        fields_to_update = set()

        for summary_id, summary in summaries_with_updates.items():
            updates = alert_updates.get(summary_id)
            if not updates:
                continue
            for field, value in updates.items():
                if field not in MODIFIABLE_ALERT_SUMMARY_FIELDS:
                    continue
                summaries_to_update.add(summary)
                fields_to_update.add(field)
                logger.info(
                    f"Summary ID {summary_id}, {field}: {getattr(summary, field)} to {value}"
                )
                setattr(summary, field, value)

        num_updated = PerformanceAlertSummary.objects.bulk_update(
            list(summaries_to_update), list(fields_to_update)
        )
        logger.info(f"{num_updated} summaries updated")

    def comment_alert_bugs(self, alerts, *args, **kwargs):
        pass

    def file_alert_bugs(self, alerts, *args, **kwargs):
        pass

    def modify_alert_bugs(self, alerts, *args, **kwargs):
        pass

    def email_alerts(self, alerts, *args, **kwargs):
        pass

    def house_keeping(self, alerts, *args, **kwargs):
        pass
