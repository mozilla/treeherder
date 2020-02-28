from datetime import datetime
from typing import List

from treeherder.perf.alerts import BackfillReport
from treeherder.perf.backfill_reporter import BackfillReporter


class PerfSfheriffBot:
    """
    Wrapper for alerts report and backfill activites.
    """
    def __init__(self, report_options: dict):
        self.reporter = BackfillReporter(report_options)

    def report(self, since: datetime, frameworks: List[str], repositories: List[str]) -> List[BackfillReport]:
        return self.reporter.report(since, frameworks, repositories)

    def backfill(self):
        pass
