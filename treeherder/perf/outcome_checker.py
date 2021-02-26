from typing import List, Tuple

from enum import Enum

from treeherder.model.models import Job, Push
from treeherder.perf.models import (
    BackfillRecord,
)


class OutcomeStatus(Enum):
    SUCCESSFUL = 1
    FAILED = 2
    IN_PROGRESS = 3


# TODO: delete this after soft launch lands (job_type will come from BackfillRecord)
def get_job_type(record):
    record_context = record.get_context()
    job_type = None

    if len(record_context) >= 1:
        job_id = record_context[0]["job_id"]
        job = Job.objects.get(id=job_id)
        if job:
            job_type = job.job_type

    return job_type


class OutcomeChecker:
    """
    Checks outcome of backfills
    """

    def __init__(self):
        pass

    def check(self, record: BackfillRecord) -> OutcomeStatus:
        # TODO: get job_type from record when soft launch lands ---> job_type = record.job_type
        job_type = get_job_type(record)
        from_time, to_time = self._get_push_timestamp_range(record.get_context())
        repository_id = record.alert.summary.repository.id
        pushes_in_range = self._get_pushes_in_range(from_time, to_time, repository_id)

        for push in pushes_in_range:
            # make sure it has at least one successful job of job type
            if push.jobs.filter(job_type=job_type, result="success").count() == 0:
                # if there is no successful job of job_type in push, we check for jobs of job_type that are still running
                if push.jobs.filter(job_type=job_type, result="unknown").count() == 0:
                    return OutcomeStatus.FAILED
                else:
                    return OutcomeStatus.IN_PROGRESS

        return OutcomeStatus.SUCCESSFUL

    @staticmethod
    def _get_pushes_in_range(from_time, to_time, repository_id) -> List[Push]:
        return Push.objects.filter(
            repository_id=repository_id, time__gte=from_time, time__lte=to_time
        ).all()

    @staticmethod
    def _get_push_timestamp_range(context: List[dict]) -> Tuple[str, str]:
        from_time = context[0]["push_timestamp"]
        to_time = context[-1]["push_timestamp"]

        return from_time, to_time
