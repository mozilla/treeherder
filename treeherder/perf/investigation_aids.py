import logging
from functools import reduce
from typing import List

import jsone
import requests
import taskcluster
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Subquery

from treeherder.model.models import (Job,
                                     JobType)
from treeherder.utils.taskcluster_lib_scopes import satisfiesExpression

logger = logging.getLogger(__name__)

CLIENT_ID = settings.PERF_SHERIFF_BOT_CLIENT_ID
ACCESS_TOKEN = settings.PERF_SHERIFF_BOT_ACCESS_TOKEN


class TaskclusterModel:
    """
    This basically rewrites frontend's TaskclusterModel from
    Javascript to Python
    """
    KNOWN_KINDS = {'task', 'hook'}

    def __init__(self, root_url=None, client_id=None, access_token=None):
        self.client_id = client_id or CLIENT_ID
        self.access_token = access_token or ACCESS_TOKEN
        init_api = {
            'rootUrl': root_url or 'https://firefox-ci-tc.services.mozilla.com',
            'credentials': {'clientId': self.client_id, 'accessToken': self.access_token},
        }

        # Taskcluster APIs
        self.queue = taskcluster.Queue(init_api)
        self.auth = taskcluster.Auth(init_api)
        self.hooks = taskcluster.Hooks(init_api)

    def load(self, decision_task_id: str, job: Job) -> dict:
        if not decision_task_id:
            raise ValueError("No decision task, can't find taskcluster actions")

        # fetch preparations
        actions_url = self.queue.buildUrl('getLatestArtifact',
                                          decision_task_id,
                                          'public/actions.json')
        original_task_id = job.taskcluster_metadata.task_id

        # fetch
        logger.debug(f"Fetching action.json from {actions_url}...")
        actions_response = requests.get(actions_url)
        task_definition = self.queue.task(original_task_id)

        if not actions_response.ok:
            raise RuntimeError('Unable to load actions.json')

        actions_json = actions_response.json()
        if actions_json['version'] != 1:
            raise RuntimeError('Wrong version of actions.json, unable to continue')

        return {
            'originalTask': task_definition,
            'originalTaskId': original_task_id,
            'staticActionVariables': actions_json['variables'],
            'actions': self._filter_relevant_actions(actions_json, task_definition),
        }

    def submit(self,
               action=None,
               action_task_id=None,
               decision_task_id=None,
               task_id=None,
               task=None,
               input=None,
               static_action_variables=None) -> str:
        context = self._defaults({},
                                 {
                                    "taskGroupId": decision_task_id,
                                    "taskId": task_id or None,
                                    "input": input,
                                 },
                                 static_action_variables)

        if action["kind"] == "task":
            raise NotImplementedError("Unable to submit actions with 'task' kind.")

        if action["kind"] == "hook":
            hook_payload = jsone.render(action["hookPayload"], context)
            hook_id, hook_group_id = action["hookId"], action["hookGroupId"]

            decision_task = self.queue.task(decision_task_id)
            expansion = self.auth.expandScopes({"scopes": decision_task["scopes"]})
            expression = f"in-tree:hook-action:{hook_group_id}/{hook_id}"

            if not satisfiesExpression(expansion["scopes"], expression):
                raise RuntimeError(f"Action is misconfigured: decision task's scopes do not satisfy {expression}")

            result = self.hooks.triggerHook(hook_group_id, hook_id, hook_payload)
            return result["status"]["taskId"]

    def has_credentials(self):
        return self.client_id and self.access_token

    @staticmethod
    def _defaults(target, *sources):
        """mimics lodash's defaults"""
        for source in sources:
            for key, value in source.items():
                target.setdefault(key, value)

        return target

    @staticmethod
    def _fetch_job(job_id: str):
        return (Job.objects
                .prefetch_related('taskcluster_metadata')
                .get(id=job_id))

    @classmethod
    def _filter_relevant_actions(cls, actions_json: dict, original_task) -> List:
        actions = actions_json['actions']

        def collect_relevant_actions(accumulating_actions, action):
            acc_action_names = [action['name'] for action in accumulating_actions]

            action_of_known_kind = cls._has_known_kind(action)
            action_is_relevant = action['name'] not in acc_action_names
            no_context_or_task_to_check = (not len(action['context'])) and (not original_task)
            task_is_in_context = (original_task and original_task.get('tags') and
                                  cls._task_in_context(action['context'], original_task['tags']))

            if (action_of_known_kind and action_is_relevant and
                    (no_context_or_task_to_check or task_is_in_context)):
                accumulating_actions.append(action)
            return accumulating_actions

        actions = reduce(collect_relevant_actions, actions, [])
        return list(actions)

    @classmethod
    def _has_known_kind(cls, action):
        return action['kind'] in cls.KNOWN_KINDS

    @classmethod
    def _task_in_context(cls, tag_set_list, task_tags):
        return any(
            all(task_tags.get(tag) and task_tags[tag] == tag_set[tag]
                for tag in tag_set.keys())
            for tag_set in tag_set_list
        )


class BackfillTool:

    def __init__(self, taskcluster_model: TaskclusterModel):
        self.tc_model = taskcluster_model

    def backfill_job(self, job_id: str) -> str:
        job = self._fetch_job(job_id)

        if not self.can_backfill(job):
            logger.warning(f"Cannot backfill job {job_id}.")
            return ''

        decision_job = self._fetch_associated_decision_job(job)
        decision_task_id = decision_job.taskcluster_metadata.task_id

        results = self.tc_model.load(decision_task_id, job)
        backfill_task = self._get_action(results["actions"], "backfill")

        logger.debug(f"Requesting backfill for task {results['originalTaskId']}...")
        task_id = self.tc_model.submit(
            action=backfill_task,
            decision_task_id=decision_task_id,
            task_id=results["originalTaskId"],
            input={},
            static_action_variables=results["staticActionVariables"]
        )
        return task_id

    def can_backfill(self, job: Job) -> bool:
        has_credentials = self.tc_model.has_credentials()
        is_try_repo = job.repository.is_try_repo

        if not has_credentials:
            logger.debug("Credentials for backfilling are missing.")
        if is_try_repo:
            logger.debug("Try repository isn't suited for backfilling.")
        return has_credentials and not is_try_repo

    @staticmethod
    def _fetch_job(job_id: str) -> Job:
        try:
            return Job.objects.get(id=job_id)
        except ObjectDoesNotExist:
            raise LookupError(f"Job {job_id} not found.")

    @staticmethod
    def _fetch_associated_decision_job(job) -> Job:
        logger.debug(f"Fetching decision task of job {job.id}...")
        decision_type = JobType.objects.filter(name="Gecko Decision Task",
                                               symbol="D")
        return Job.objects.get(repository_id=job.repository_id,
                               job_type_id=Subquery(decision_type.values('id')[:1]),
                               push_id=job.push_id)

    @staticmethod
    def _get_action(action_array: list, action_name: str) -> str:
        try:
            return [a for a in action_array if a["name"] == action_name][0]
        except IndexError:
            available_actions = ", ".join([a["name"] for a in action_array])
            raise LookupError(f"{action_name} action is not available for this task.  Available: {available_actions}")
