from datetime import datetime
from typing import List

from treeherder.perf.alerts import BackfillReport


class PerfSheriffBot:
    """
    Wrapper class used to aggregate the reporting of backfill reports.
    """
    def __init__(self, report_maintainer):
        self.report_maintainer = report_maintainer

    def report(self, since: datetime,
               frameworks: List[str],
               repositories: List[str]) -> List[BackfillReport]:
        return self.report_maintainer.provide_updated_reports(since, frameworks, repositories)
