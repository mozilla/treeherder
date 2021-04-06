from datetime import timedelta

from django.conf import settings

from treeherder.perf.auto_perf_sheriffing.backfill_reports import (
    BackfillReportMaintainer,
    AlertsPicker,
    IdentifyAlertRetriggerables,
)
from treeherder.perf.auto_perf_sheriffing.backfill_tool import BackfillTool
from treeherder.perf.auto_perf_sheriffing.sherlock import Sherlock
from treeherder.perf.auto_perf_sheriffing.secretary import Secretary
from treeherder.services.taskcluster import DEFAULT_ROOT_URL, notify_client_factory
from treeherder.services.taskcluster import TaskclusterModelNullObject


def sherlock_factory(days_to_lookup: timedelta) -> Sherlock:
    report_maintainer = __report_maintainer_factory(days_to_lookup)
    backfill_tool = __backfill_tool_factory()
    secretary = Secretary()
    notify_client = notify_client_factory()

    return Sherlock(report_maintainer, backfill_tool, secretary, notify_client)


def __report_maintainer_factory(days_to_lookup: timedelta) -> BackfillReportMaintainer:
    alerts_picker = AlertsPicker(
        max_alerts=5,
        max_improvements=2,
        platforms_of_interest=('windows10', 'windows7', 'linux', 'osx', 'android'),
    )
    backfill_context_fetcher = IdentifyAlertRetriggerables(
        max_data_points=5, time_interval=days_to_lookup
    )
    return BackfillReportMaintainer(alerts_picker, backfill_context_fetcher)


def __backfill_tool_factory() -> BackfillTool:
    taskcluster = TaskclusterModelNullObject(
        DEFAULT_ROOT_URL,
        settings.PERF_SHERIFF_BOT_CLIENT_ID,
        settings.PERF_SHERIFF_BOT_ACCESS_TOKEN,
    )
    backfill_tool = BackfillTool(taskcluster)
    return backfill_tool
