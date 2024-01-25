import logging

from django.core.exceptions import ObjectDoesNotExist
from typing import Union

from treeherder.model.models import Job
from treeherder.perf.exceptions import CannotBackfill
from treeherder.services.taskcluster import TaskclusterModel

logger = logging.getLogger(__name__)


class BackfillTool:
    def __init__(self, taskcluster_model: TaskclusterModel):
        self.__taskcluster = taskcluster_model

    def backfill_job(self, job: Union[Job, str]) -> str:
        if not isinstance(job, Job):
            job = self._fetch_job_by_id(job)

        self.assert_backfill_ability(job)

        logger.debug(f"Fetching decision task of job {job.id}...")
        task_id_to_backfill = job.taskcluster_metadata.task_id
        decision_job = job.fetch_associated_decision_job()
        decision_task_id = decision_job.taskcluster_metadata.task_id

        if "browsertime" in job.job_group.name.lower():
            logger.debug(f"Requesting side_by_side for task {task_id_to_backfill}...")
            side_by_side_task_id = self.__taskcluster.trigger_action(
                action="side-by-side",
                task_id=task_id_to_backfill,
                decision_task_id=decision_task_id,
                input={},
                root_url=job.repository.tc_root_url,
            )
            logger.info(
                f"Task id {side_by_side_task_id} created when triggered side_by_side for job id {task_id_to_backfill}"
            )
        logger.debug(f"Requesting backfill for task {task_id_to_backfill}...")
        task_id = self.__taskcluster.trigger_action(
            action="backfill",
            task_id=task_id_to_backfill,
            decision_task_id=decision_task_id,
            input={
                "retrigger": False,
            },
            root_url=job.repository.tc_root_url,
        )
        return task_id

    def assert_backfill_ability(self, over_job: Job):
        if over_job.repository.is_try_repo:
            raise CannotBackfill("Try repository isn't suited for backfilling.")

    @staticmethod
    def _fetch_job_by_id(job_id: str) -> Job:
        try:
            return Job.objects.get(id=job_id)
        except ObjectDoesNotExist:
            raise LookupError(f"Job {job_id} not found.")
