import logging
from typing import List

import jsone
import taskcluster

from treeherder.utils.taskcluster_lib_scopes import satisfiesExpression

logger = logging.getLogger(__name__)

DEFAULT_ROOT_URL = 'https://firefox-ci-tc.services.mozilla.com'


class TaskclusterModel:
    """Javascript -> Python rewrite of frontend's TaskclusterModel"""

    def __init__(self, root_url, client_id=None, access_token=None):
        options = {'rootUrl': root_url}
        credentials = {}

        if client_id:
            credentials['clientId'] = client_id
        if access_token:
            credentials['accessToken'] = access_token

        # Taskcluster APIs
        self.hooks = taskcluster.Hooks({**options, 'credentials': credentials})

        # Following least-privilege principle, as services
        # bellow don't really need authorization credentials.
        self.queue = taskcluster.Queue(options)
        self.auth = taskcluster.Auth(options)

    def set_root_url(self, root_url):
        for service in (self.hooks, self.queue, self.auth):
            service.options['rootUrl'] = root_url

    def trigger_action(self, action, task_id, decision_task_id, input, root_url=None) -> str:
        if root_url is not None:
            self.set_root_url(root_url)

        actions_context = self._load(decision_task_id, task_id)
        action_to_trigger = self._get_action(actions_context['actions'], action)

        return self._submit(
            action=action_to_trigger,
            decision_task_id=decision_task_id,
            task_id=task_id,
            input=input,
            static_action_variables=actions_context['staticActionVariables']
        )

    def _load(self, decision_task_id: str, task_id: str) -> dict:
        if not decision_task_id:
            raise ValueError("No decision task, can't find taskcluster actions")

        # fetch
        logger.debug('Fetching actions.json...')
        actions_json = self.queue.getLatestArtifact(decision_task_id, 'public/actions.json')
        task_definition = self.queue.task(task_id)

        if actions_json['version'] != 1:
            raise RuntimeError('Wrong version of actions.json, unable to continue')

        return {
            'staticActionVariables': actions_json['variables'],
            'actions': self._filter_relevant_actions(actions_json, task_definition),
        }

    def _submit(self,
                action=None,
                decision_task_id=None,
                task_id=None,
                input=None,
                static_action_variables=None) -> str:
        context = {
                "taskGroupId": decision_task_id,
                "taskId": task_id or None,
                "input": input,
         }
        context.update(static_action_variables)
        action_kind = action["kind"]

        if action_kind == "hook":
            hook_payload = jsone.render(action["hookPayload"], context)
            hook_id, hook_group_id = action["hookId"], action["hookGroupId"]

            decision_task = self.queue.task(decision_task_id)
            expansion = self.auth.expandScopes({"scopes": decision_task["scopes"]})
            expression = f"in-tree:hook-action:{hook_group_id}/{hook_id}"

            if not satisfiesExpression(expansion["scopes"], expression):
                raise RuntimeError(f"Action is misconfigured: decision task's scopes do not satisfy {expression}")

            result = self.hooks.triggerHook(hook_group_id, hook_id, hook_payload)
            return result["status"]["taskId"]

        raise NotImplementedError(f"Unable to submit actions with '{action_kind}' kind.")

    @classmethod
    def _filter_relevant_actions(cls, actions_json: dict, original_task: dict) -> list:
        relevant_actions = {}

        for action in actions_json['actions']:
            action_name = action['name']
            if action_name in relevant_actions:
                continue

            no_context_or_task_to_check = (not len(action['context'])) and (not original_task)
            task_is_in_context = (original_task and original_task.get('tags') and
                                  cls._task_in_context(action['context'], original_task['tags']))

            if no_context_or_task_to_check or task_is_in_context:
                relevant_actions[action_name] = action

        return list(relevant_actions.values())

    @staticmethod
    def _get_action(action_array: list, action_name: str) -> str:
        """
        Each action entry (from action array) must define a name, title and description.
        The order of the array of actions is **significant**: actions should be displayed
        in this order, and when multiple actions apply, **the first takes precedence**.

        More updated details: https://docs.taskcluster.net/docs/manual/design/conventions/actions/spec#action-metadata

        @return: most relevant action entry
        """
        try:
            return [a for a in action_array if a["name"] == action_name][0]
        except IndexError:
            available_actions = ", ".join(sorted(
                {a["name"] for a in action_array}
            ))
            raise LookupError(f"{action_name} action is not available for this task.  Available: {available_actions}")

    @classmethod
    def _task_in_context(cls, context: List[dict], task_tags: dict) -> bool:
        """
        A task (as defined by its tags) is said to match a tag-set if its
        tags are a super-set of the tag-set. A tag-set is a set of key-value pairs.

        An action (as defined by its context) is said to be relevant for
        a given task, if that task's tags match one of the tag-sets given
        in the context property for the action.

        More updated details: https://docs.taskcluster.net/docs/manual/design/conventions/actions/spec#action-context

        @param context: list of tag-sets
        @param task_tags: task's tags
        """
        return any(
            all(tag in task_tags and task_tags[tag] == tag_set[tag]
                for tag in tag_set.keys())
            for tag_set in context
        )
