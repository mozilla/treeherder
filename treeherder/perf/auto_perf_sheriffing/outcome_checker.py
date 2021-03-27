from typing import List, Tuple

import logging
import time
from datetime import datetime
from django.conf import settings
from enum import Enum

from treeherder.model.models import Job, Push
from treeherder.perf.models import (
    BackfillRecord, PerformanceDatum,
)
from treeherder.perfalert.perfalert import RevisionDatum

logger = logging.getLogger(__name__)


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

    def get_backfilled_data(self, record: BackfillRecord) -> List[Push]:
        max_alert_age = datetime.now() - settings.PERFHERDER_ALERTS_MAX_AGE
        series = PerformanceDatum.objects.filter(signature=record.alert.series_signature, push_timestamp__gte=max_alert_age)

        series_prev = series.filter(
            push_timestamp__lte=record.alert.summary.push.time
        ).order_by('push_timestamp')

        series_post = series.filter(
            push_timestamp__gt=record.alert.summary.push.time
        ).order_by("push_timestamp")

        repository_id = record.alert.summary.repository.id
        from_time, to_time = self._get_push_timestamp_range(record.get_context())
        pushes = self._get_pushes_in_range(from_time, to_time, repository_id)

        full_series = [
            datum
            for datum in series_prev[max(len(series_prev) - max(12, len(pushes)), 0):]
        ] + [datum for datum in series_post[:12]]

        revision_data = {}
        for d in full_series:
            if not revision_data.get(d.push_id):
                revision_data[d.push_id] = RevisionDatum(
                    int(time.mktime(d.push_timestamp.timetuple())), d.push_id, []
                )
            revision_data[d.push_id].values.append(d.value)

        return revision_data

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
