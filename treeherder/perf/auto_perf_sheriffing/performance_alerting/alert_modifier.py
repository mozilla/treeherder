import logging
from datetime import timedelta

from treeherder.perf.auto_perf_sheriffing.bug_searcher import BugSearcher
from treeherder.perf.models import PerformanceAlertSummary

logger = logging.getLogger(__name__)


class PerformanceAlertSummaryModifier:
    updaters = []

    @staticmethod
    def add(updater_class):
        PerformanceAlertSummaryModifier.updaters.append(updater_class)

    @staticmethod
    def get_updaters():
        return PerformanceAlertSummaryModifier.updaters

    @staticmethod
    def get_alert_summary_updates(*args, **kwargs):
        all_updates = {}
        all_summaries_to_update = {}
        for updater in PerformanceAlertSummaryModifier.get_updaters():
            updates, summaries_to_update = updater.update_alerts(**kwargs)
            if not updates:
                continue
            all_updates.update(updates)
            all_summaries_to_update.update(summaries_to_update)
        return all_updates, all_summaries_to_update


@PerformanceAlertSummaryModifier.add
class ResolutionModifier:
    @staticmethod
    def update_alerts(**kwargs):
        bug_searcher = BugSearcher()
        start_date = bug_searcher.get_today_date() - timedelta(days=7)
        bug_searcher.set_include_fields(["id", "resolution", "status"])
        bug_searcher.set_query(
            {
                "f1": "keywords",
                "o1": "anywords",
                "v1": "perf-alert",
                "f2": "resolution",
                "o2": "changedafter",
                "v2": start_date,
            }
        )

        try:
            bugs = bug_searcher.get_bugs()
        except Exception as e:
            logger.warning(f"Failed to get bugs for alert resolution updates: {str(e)}")
            return ({}, {})

        alert_summaries = PerformanceAlertSummary.objects.filter(
            bug_number__in=[bug_info["id"] for bug_info in bugs["bugs"]]
        )

        bug_status_map = {label: value for value, label in PerformanceAlertSummary.BUG_STATUSES}
        bugs_by_id = {bug["id"]: bug for bug in bugs["bugs"]}
        updates = {}
        summaries_to_update = {}
        for summary in alert_summaries:
            bug = bugs_by_id.get(summary.bug_number)
            if not bug:
                continue
            new_bug_status = bug_status_map.get(bug["resolution"])
            if new_bug_status is None and bug["resolution"] == "":
                new_bug_status = PerformanceAlertSummary.BUG_NEW
            if new_bug_status is None:
                continue
            if summary.bug_status == new_bug_status:
                continue
            updates[str(summary.id)] = {"bug_status": new_bug_status}
            summaries_to_update[str(summary.id)] = summary

        return updates, summaries_to_update
