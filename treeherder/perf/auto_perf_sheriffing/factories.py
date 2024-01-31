from datetime import timedelta

from treeherder.perf.auto_perf_sheriffing.backfill_reports import (
    BackfillReportMaintainer,
    AlertsPicker,
    IdentifyAlertRetriggerables,
)
from treeherder.perf.auto_perf_sheriffing.backfill_tool import BackfillTool
from treeherder.perf.auto_perf_sheriffing.sherlock import Sherlock
from treeherder.perf.auto_perf_sheriffing.secretary import Secretary
from treeherder.services.taskcluster import taskcluster_model_factory


def sherlock_factory(days_to_lookup: timedelta) -> Sherlock:
    report_maintainer = __report_maintainer_factory(days_to_lookup)
    backfill_tool = backfill_tool_factory()
    secretary = Secretary()

    return Sherlock(report_maintainer, backfill_tool, secretary)


def __report_maintainer_factory(days_to_lookup: timedelta) -> BackfillReportMaintainer:
    alerts_picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=(
            "windows10",
            "linux",
            "osx",
            "android",
            "windows7",
        ),  # windows7 lost it's relevance due to lower alert rate on this platform
    )
    backfill_context_fetcher = IdentifyAlertRetriggerables(
        max_data_points=5, time_interval=days_to_lookup
    )
    return BackfillReportMaintainer(alerts_picker, backfill_context_fetcher)


def backfill_tool_factory() -> BackfillTool:
    taskcluster = taskcluster_model_factory()

    backfill_tool = BackfillTool(taskcluster)
    return backfill_tool
