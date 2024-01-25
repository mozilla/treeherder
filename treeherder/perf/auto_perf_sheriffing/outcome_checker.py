from enum import Enum

from treeherder.perf.models import (
    BackfillRecord,
)


class OutcomeStatus(Enum):
    SUCCESSFUL = 1
    FAILED = 2
    IN_PROGRESS = 3


class OutcomeChecker:
    """
    Checks outcome of backfills and counts total of tasks in progress, successful, failed
    """

    def __init__(self):
        pass

    def check(self, record: BackfillRecord) -> OutcomeStatus:
        if record.job_type is None:
            raise ValueError(f"No job_type for record {record.alert.id}.")
        of_type = record.job_type
        with_successful_results = "success"  # state is "completed"
        with_unknown_results = "unknown"  # state is "running" or "pending"
        total_backfills_in_progress = 0
        total_backfills_failed = 0
        total_backfills_successful = 0

        pushes_in_range = record.get_pushes_in_context_range()
        for push in pushes_in_range:
            # make sure it has at least one successful job of job type
            if push.total_jobs(of_type, with_successful_results) == 0:
                # either (at least) one job is in progress or it failed
                if push.total_jobs(of_type, with_unknown_results) > 0:
                    total_backfills_in_progress += 1
                else:
                    total_backfills_failed += 1
            else:
                total_backfills_successful += 1

        record.total_backfills_failed = total_backfills_failed
        record.total_backfills_successful = total_backfills_successful
        record.total_backfills_in_progress = total_backfills_in_progress
        record.save()

        if total_backfills_in_progress > 0:
            return OutcomeStatus.IN_PROGRESS
        elif total_backfills_failed > 0:
            return OutcomeStatus.FAILED
        elif total_backfills_successful > 0:
            return OutcomeStatus.SUCCESSFUL
