from datetime import datetime
from typing import List

from treeherder.perf.alerts import (AlertsPicker,
                                    BackfillReport,
                                    BackfillReportMaintainer,
                                    IdentifyAlertRetriggerables)


class PerfSfheriffBot:
    """
    Wrapper class used to aggregate the reporting of backfill reports.
    """
    def __init__(self, alerts_picker: AlertsPicker, backfill_context_fetcher: IdentifyAlertRetriggerables):
        self.reportMaintainer = BackfillReportMaintainer(alerts_picker, backfill_context_fetcher)

    def report(self, since: datetime,
               frameworks: List[str],
               repositories: List[str]) -> List[BackfillReport]:
        return self.reportMaintainer.provide_updated_reports(since, frameworks, repositories)
