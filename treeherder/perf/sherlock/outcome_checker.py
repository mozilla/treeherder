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
    Checks outcome of backfills
    """

    def __init__(self):
        pass

    def check(self, record: BackfillRecord) -> OutcomeStatus:
        if record.job_type is None:
            raise ValueError(f"No job_type for record {record.alert.id}.")
        of_type = record.job_type
        with_successful_results = 'success'
        with_unknown_results = 'unknown'

        pushes_in_range = record.get_pushes_in_context_range()
        for push in pushes_in_range:
            # make sure it has at least one successful job of job type
            if push.total_jobs(of_type, with_successful_results) == 0:
                # either (at least) one job is in progress or it failed
                if push.total_jobs(of_type, with_unknown_results) > 0:
                    return OutcomeStatus.IN_PROGRESS
                else:
                    return OutcomeStatus.FAILED
        return OutcomeStatus.SUCCESSFUL
