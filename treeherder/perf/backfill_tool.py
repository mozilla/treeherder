import logging

from django.core.exceptions import ObjectDoesNotExist

from treeherder.model.models import Job
from treeherder.perf.exceptions import CannotBackfill
from treeherder.services.taskcluster import TaskclusterModel

logger = logging.getLogger(__name__)


class BackfillTool:
    def __init__(self, taskcluster_model: TaskclusterModel):
        self.tc_model = taskcluster_model

    def backfill_job(self, job_id: str) -> str:
        job = self._fetch_job(job_id)

        self.assert_backfill_ability(job)

        logger.debug(f"Fetching decision task of job {job.id}...")
        task_id_to_backfill = job.taskcluster_metadata.task_id
        decision_job = job.fetch_associated_decision_job()
        decision_task_id = decision_job.taskcluster_metadata.task_id

        logger.debug(f"Requesting backfill for task {task_id_to_backfill}...")
        task_id = self.tc_model.trigger_action(
            action='backfill',
            task_id=task_id_to_backfill,
            decision_task_id=decision_task_id,
            input={},
            root_url=job.repository.tc_root_url,
        )
        return task_id

    def assert_backfill_ability(self, over_job: Job):
        if over_job.repository.is_try_repo:
            raise CannotBackfill("Try repository isn't suited for backfilling.")

    @staticmethod
    def _fetch_job(job_id: str) -> Job:
        try:
            return Job.objects.get(id=job_id)
        except ObjectDoesNotExist:
            raise LookupError(f"Job {job_id} not found.")
