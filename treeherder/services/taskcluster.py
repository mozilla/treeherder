import logging
import uuid
from abc import ABC, abstractmethod
import requests

import jsone
import taskcluster
from django.conf import settings

from treeherder.utils.taskcluster_lib_scopes import satisfiesExpression

logger = logging.getLogger(__name__)

DEFAULT_ROOT_URL = "https://firefox-ci-tc.services.mozilla.com"


class TaskclusterModel(ABC):
    """Javascript -> Python rewrite of frontend's TaskclusterModel"""

    def __init__(self, root_url, client_id=None, access_token=None):
        pass

    @abstractmethod
    def trigger_action(
        self, action: str, task_id: str, decision_task_id: str, input: dict, root_url: str = None
    ) -> str:
        pass  # pragma: no cover


class TaskclusterModelImpl(TaskclusterModel):
    """Javascript -> Python rewrite of frontend' s TaskclusterModel"""

    def __init__(self, root_url, client_id=None, access_token=None):
        options = {"rootUrl": root_url}
        credentials = {}

        if client_id:
            credentials["clientId"] = client_id
        if access_token:
            credentials["accessToken"] = access_token

        # Taskcluster APIs
        self.hooks = taskcluster.Hooks({**options, "credentials": credentials})

        # Following least-privilege principle, as services
        # bellow don't really need authorization credentials.
        self.queue = taskcluster.Queue(options)
        self.auth = taskcluster.Auth(options)

    def trigger_action(
        self, action: str, task_id: str, decision_task_id: str, input: dict, root_url: str = None
    ) -> str:
        if root_url is not None:
            self.__set_root_url(root_url)

        actions_context = self._load(decision_task_id, task_id)
        action_to_trigger = self._get_action(actions_context["actions"], action)

        return self._submit(
            action=action_to_trigger,
            decision_task_id=decision_task_id,
            task_id=task_id,
            input=input,
            static_action_variables=actions_context["staticActionVariables"],
        )

    def __set_root_url(self, root_url):
        for service in (self.hooks, self.queue, self.auth):
            service.options["rootUrl"] = root_url

    def _load(self, decision_task_id: str, task_id: str) -> dict:
        if not decision_task_id:
            raise ValueError("No decision task, can't find taskcluster actions")

        # fetch
        logger.debug("Fetching actions.json...")

        actions_url = self.queue.buildUrl(
            self.queue.funcinfo["getLatestArtifact"]["name"],
            decision_task_id,
            "public/actions.json",
        )
        response = requests.request("GET", actions_url)
        actions_json = response.json()

        task_definition = self.queue.task(task_id)

        if actions_json["version"] != 1:
            raise RuntimeError("Wrong version of actions.json, unable to continue")

        return {
            "staticActionVariables": actions_json["variables"],
            "actions": self._filter_relevant_actions(actions_json, task_definition),
        }

    def _submit(
        self,
        action=None,
        decision_task_id=None,
        task_id=None,
        input=None,
        static_action_variables=None,
    ) -> str:
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
                raise RuntimeError(
                    f"Action is misconfigured: decision task's scopes do not satisfy {expression}"
                )

            result = self.hooks.triggerHook(hook_group_id, hook_id, hook_payload)
            return result["status"]["taskId"]

        raise NotImplementedError(f"Unable to submit actions with '{action_kind}' kind.")

    @classmethod
    def _filter_relevant_actions(cls, actions_json: dict, original_task: dict) -> list:
        relevant_actions = {}

        for action in actions_json["actions"]:
            action_name = action["name"]
            if action_name in relevant_actions:
                continue

            no_context_or_task_to_check = (not len(action["context"])) and (not original_task)
            task_is_in_context = (
                original_task
                and original_task.get("tags")
                and cls._task_in_context(action["context"], original_task["tags"])
            )

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
            available_actions = ", ".join(sorted({a["name"] for a in action_array}))
            raise LookupError(
                f"{action_name} action is not available for this task.  Available: {available_actions}"
            )

    @classmethod
    def _task_in_context(cls, context: list[dict], task_tags: dict) -> bool:
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
            all(tag in task_tags and task_tags[tag] == tag_set[tag] for tag in tag_set.keys())
            for tag_set in context
        )


class TaskclusterModelNullObject(TaskclusterModel):
    """
    Stubbed version of TaskclusterModelImpl (useful on non-production environments)
    """

    def trigger_action(
        self, action: str, task_id: str, decision_task_id: str, input: dict, root_url: str = None
    ) -> str:
        suffix = self.__randomized_value()
        return f"fake-backfill-task-id-for-{task_id}-{suffix}"

    @staticmethod
    def __randomized_value() -> str:
        return uuid.uuid4().hex


class Notify(ABC):
    @abstractmethod
    def email(self, *args, **kwargs):
        pass  # pragma: no cover


class NotifyAdapter(Notify):
    def __init__(self, options=None, session=None):
        self._notify_adaptee = taskcluster.Notify(options, session)

    def email(self, *args, **kwargs):
        return self._notify_adaptee.email(*args, **kwargs)


class NotifyNullObject(Notify):
    def email(self, *args, **kwargs):
        logger.debug(f"Faking sending of email `{args}`")


def taskcluster_model_factory() -> TaskclusterModel:
    client_id = settings.PERF_SHERIFF_BOT_CLIENT_ID
    access_token = settings.PERF_SHERIFF_BOT_ACCESS_TOKEN

    options = dict(root_url=DEFAULT_ROOT_URL, client_id=client_id, access_token=access_token)

    if client_id and access_token:
        return TaskclusterModelImpl(**options)
    return TaskclusterModelNullObject(**options)


def notify_client_factory(
    root_url: str = None, client_id: str = None, access_token: str = None
) -> Notify:
    client_id, access_token = autofind_unprovided(access_token, client_id)

    if client_id and access_token:  # we're on production
        options = {
            "rootUrl": root_url or DEFAULT_ROOT_URL,
            "credentials": {
                "clientId": client_id,
                "accessToken": access_token,
            },
        }
        return NotifyAdapter(options)

    # not on production and/or shouldn't email anything
    return NotifyNullObject()


def autofind_unprovided(access_token, client_id) -> tuple[str, str]:
    client_id = client_id or settings.NOTIFY_CLIENT_ID
    access_token = access_token or settings.NOTIFY_ACCESS_TOKEN
    return client_id, access_token
