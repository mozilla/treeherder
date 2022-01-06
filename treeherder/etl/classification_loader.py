import logging

import environ
import newrelic.agent

from treeherder.model.models import MozciClassification, Push, Repository
from treeherder.utils.taskcluster import get_artifact, get_task_definition

env = environ.Env()
logger = logging.getLogger(__name__)


class ClassificationLoader:
    def process(self, pulse_job, root_url):
        task_id = pulse_job["status"]["taskId"]

        task = get_task_definition(root_url, task_id)
        _, _, _, _, project, _, revision = task["routes"][0].split(".")

        try:
            newrelic.agent.add_custom_parameter("project", project)

            repository = Repository.objects.get(name=project)
        except Repository.DoesNotExist:
            logger.info("Job with unsupported project: %s", project)
            return

        try:
            newrelic.agent.add_custom_parameter("revision", revision)

            revision_field = 'revision__startswith' if len(revision) < 40 else 'revision'
            filter_kwargs = {'repository': repository, revision_field: revision}

            push = Push.objects.get(**filter_kwargs)
        except Push.DoesNotExist:
            logger.info("Job with unsupported revision: %s", revision)
            return

        classification_json = get_artifact(root_url, task_id, "public/classification.json")
        classification_json["push"]["classification"]

        mapping = [
            value
            for value, label in MozciClassification.CLASSIFICATION_RESULT
            if label == classification_json["push"]["classification"].lower()
        ]
        MozciClassification.objects.create(
            push=push,
            result=mapping[0],
            task_id=task_id,
        )
