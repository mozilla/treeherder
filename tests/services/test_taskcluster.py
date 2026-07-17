import logging
from unittest.mock import MagicMock

import pytest

from tests.conftest import SampleDataJSONLoader
from treeherder.services.taskcluster import (
    NotifyAdapter,
    NotifyNullObject,
    TaskclusterModelImpl,
    TaskclusterModelNullObject,
    notify_client_factory,
    taskcluster_model_factory,
)

load_json_fixture = SampleDataJSONLoader("sherlock")


@pytest.fixture(scope="module")
def actions_json():
    return load_json_fixture("initialActions.json")


@pytest.fixture(scope="module")
def expected_actions_json():
    return load_json_fixture("reducedActions.json")


@pytest.fixture(scope="module")
def original_task():
    return load_json_fixture("originalTask.json")


@pytest.fixture(scope="module")
def expected_backfill_task():
    return load_json_fixture("backfillTask.json")


class TestTaskclusterModelImpl:
    FAKE_ROOT_URL = "https://fakerooturl.org"
    FAKE_OPTIONS = (FAKE_ROOT_URL, "FAKE_CLIENT_ID", "FAKE_ACCESS_TOKEN")

    def test_can_instantiate_without_credentials(self):
        """Test instantiation of TaskclusterModelImpl without credentials parameter."""
        try:
            _ = TaskclusterModelImpl(self.FAKE_ROOT_URL)
        except ValueError:
            pytest.fail(
                "Should be able to instantiate TaskclusterModelImpl without providing credentials."
            )

    def test_can_instantiate_with_credentials(self):
        """Test instantiation of TaskclusterModelImpl with provided client ID and access token."""
        model = TaskclusterModelImpl(
            self.FAKE_ROOT_URL, client_id="my-client", access_token="my-token"
        )
        client_id_val = model.hooks.options["credentials"]["clientId"]
        if isinstance(client_id_val, bytes):
            client_id_val = client_id_val.decode("utf-8")
        assert client_id_val == "my-client"

        access_token_val = model.hooks.options["credentials"]["accessToken"]
        if isinstance(access_token_val, bytes):
            access_token_val = access_token_val.decode("utf-8")
        assert access_token_val == "my-token"

    def test_trigger_action(self, monkeypatch):
        """Test trigger_action routes through actions loading, resolution, and submission."""
        model = TaskclusterModelImpl(self.FAKE_ROOT_URL)

        # Mock _load, _get_action, and _submit
        loaded_context = {"actions": [{"name": "backfill"}], "staticActionVariables": {}}
        monkeypatch.setattr(model, "_load", lambda dec_id, t_id: loaded_context)
        monkeypatch.setattr(model, "_get_action", lambda actions, name: actions[0])
        monkeypatch.setattr(
            model,
            "_submit",
            lambda action, decision_task_id, task_id, input, static_action_variables: "new-task-id",
        )

        task_id = model.trigger_action(
            "backfill", "task123", "decision123", {"foo": "bar"}, root_url="https://newroot.org"
        )
        assert task_id == "new-task-id"
        assert model.hooks.options["rootUrl"] == "https://newroot.org"

    def test_load_no_decision_task_id(self):
        """Test that _load raises ValueError if no decision task ID is supplied."""
        model = TaskclusterModelImpl(self.FAKE_ROOT_URL)
        with pytest.raises(ValueError, match="No decision task, can't find taskcluster actions"):
            model._load("", "task123")

    def test_load_wrong_version(self, monkeypatch):
        """Test that _load raises RuntimeError if the actions.json schema version is not supported."""
        model = TaskclusterModelImpl(self.FAKE_ROOT_URL)

        # Mock buildUrl and task definition
        monkeypatch.setattr(model.queue, "buildUrl", lambda name, *args: "https://fake-url.com")
        monkeypatch.setattr(model.queue, "task", lambda task_id: {})

        class MockResponse:
            def json(self):
                return {"version": 2}  # Wrong version

        monkeypatch.setattr("requests.request", lambda method, url: MockResponse())

        with pytest.raises(RuntimeError, match="Wrong version of actions.json, unable to continue"):
            model._load("decision123", "task123")

    def test_load_success(self, monkeypatch):
        """Test successful loading and parsing of actions and static variables."""
        model = TaskclusterModelImpl(self.FAKE_ROOT_URL)

        monkeypatch.setattr(model.queue, "buildUrl", lambda name, *args: "https://fake-url.com")
        monkeypatch.setattr(model.queue, "task", lambda task_id: {"tags": {"kind": "test"}})

        class MockResponse:
            def json(self):
                return {
                    "version": 1,
                    "variables": {"var1": "val1"},
                    "actions": [
                        {
                            "name": "backfill",
                            "context": [{"kind": "test"}],
                        }
                    ],
                }

        monkeypatch.setattr("requests.request", lambda method, url: MockResponse())

        result = model._load("decision123", "task123")
        assert result["staticActionVariables"] == {"var1": "val1"}
        assert len(result["actions"]) == 1
        assert result["actions"][0]["name"] == "backfill"

    def test_submit_unsupported_kind(self):
        """Test that submitting an action of an unsupported kind raises NotImplementedError."""
        model = TaskclusterModelImpl(self.FAKE_ROOT_URL)
        action = {"kind": "not-hook"}
        with pytest.raises(
            NotImplementedError, match="Unable to submit actions with 'not-hook' kind"
        ):
            model._submit(
                action=action,
                decision_task_id="decision123",
                task_id="task123",
                input={},
                static_action_variables={},
            )

    def test_submit_hook_success(self, monkeypatch):
        """Test successful action submission of hook kind."""
        model = TaskclusterModelImpl(self.FAKE_ROOT_URL)

        action = {
            "kind": "hook",
            "hookPayload": {"taskGroupId": "${taskGroupId}"},
            "hookId": "my-hook-id",
            "hookGroupId": "my-hook-group-id",
        }

        monkeypatch.setattr(model.queue, "task", lambda task_id: {"scopes": ["scope1"]})
        monkeypatch.setattr(
            model.auth,
            "expandScopes",
            lambda req: {"scopes": ["in-tree:hook-action:my-hook-group-id/my-hook-id"]},
        )

        triggered = []

        def mock_trigger(group_id, hook_id, payload):
            triggered.append((group_id, hook_id, payload))
            return {"status": {"taskId": "new-task-123"}}

        monkeypatch.setattr(model.hooks, "triggerHook", mock_trigger)

        task_id = model._submit(
            action=action,
            decision_task_id="decision123",
            task_id="task123",
            input={},
            static_action_variables={},
        )
        assert task_id == "new-task-123"
        assert len(triggered) == 1
        assert triggered[0] == ("my-hook-group-id", "my-hook-id", {"taskGroupId": "decision123"})

    def test_submit_hook_unsatisfied_scopes(self, monkeypatch):
        """Test that submitting a hook action without satisfying scopes raises RuntimeError."""
        model = TaskclusterModelImpl(self.FAKE_ROOT_URL)

        action = {
            "kind": "hook",
            "hookPayload": {},
            "hookId": "my-hook-id",
            "hookGroupId": "my-hook-group-id",
        }

        monkeypatch.setattr(model.queue, "task", lambda task_id: {"scopes": ["scope1"]})
        monkeypatch.setattr(
            model.auth, "expandScopes", lambda req: {"scopes": ["some-other-scope"]}
        )

        with pytest.raises(
            RuntimeError, match="Action is misconfigured: decision task's scopes do not satisfy"
        ):
            model._submit(
                action=action,
                decision_task_id="decision123",
                task_id="task123",
                input={},
                static_action_variables={},
            )

    def test_filter_relevant_actions(self, actions_json, original_task, expected_actions_json):
        """Test filtering actions down to the relevant ones for a given task context."""
        reduced_actions_json = TaskclusterModelImpl._filter_relevant_actions(
            actions_json, original_task
        )

        assert reduced_actions_json == expected_actions_json

    def test_task_in_context(self):
        """Test identifying if a task matches action tag-sets."""
        # match
        tag_set_list, task_tags = (
            load_json_fixture(f) for f in ("matchingTagSetList.json", "matchingTaskTags.json")
        )
        assert TaskclusterModelImpl._task_in_context(tag_set_list, task_tags) is True

        # mismatch
        tag_set_list, task_tags = (
            load_json_fixture(f) for f in ("mismatchingTagSetList.json", "mismatchingTaskTags.json")
        )
        assert TaskclusterModelImpl._task_in_context(tag_set_list, task_tags) is False

    def test_task_in_context_empty_or_mismatch(self):
        """Test task matching against empty context or mismatching tags."""
        # Empty context
        assert TaskclusterModelImpl._task_in_context([], {"a": "b"}) is False
        # Task with mismatching tags
        assert TaskclusterModelImpl._task_in_context([{"a": "b"}], {"c": "d"}) is False

    def test_get_action(self, actions_json, expected_backfill_task):
        """Test selecting a specific action from a list of actions by name."""
        action_array = actions_json["actions"]

        backfill_task = TaskclusterModelImpl._get_action(action_array, "backfill")
        assert backfill_task == expected_backfill_task

    def test_get_action_lookup_error(self):
        """Test that get_action raises LookupError when the requested action is missing."""
        action_array = [{"name": "foo"}]
        with pytest.raises(
            LookupError, match="bar action is not available for this task.  Available: foo"
        ):
            TaskclusterModelImpl._get_action(action_array, "bar")

    def test_taskcluster_model_null_object(self):
        """Test trigger_action on TaskclusterModelNullObject stub returns fake task ID."""
        obj = TaskclusterModelNullObject("https://fake-root.org")
        res = obj.trigger_action("backfill", "task123", "decision123", {})
        assert res.startswith("fake-backfill-task-id-for-task123-")

    def test_notify_null_object(self, caplog):
        """Test NotifyNullObject stub logs email debug statements and doesn't send emails."""
        logger = logging.getLogger("treeherder.services.taskcluster")
        logger.setLevel(logging.DEBUG)
        obj = NotifyNullObject()
        with caplog.at_level(logging.DEBUG):
            obj.email("arg1", "arg2", foo="bar")
            assert "Faking sending of email `('arg1', 'arg2')`" in caplog.text

    def test_notify_adapter(self, monkeypatch):
        """Test NotifyAdapter calls underlying taskcluster Notify client email method."""
        mock_notify_client = MagicMock()
        monkeypatch.setattr("taskcluster.Notify", lambda options, session: mock_notify_client)

        adapter = NotifyAdapter()
        adapter.email("arg1", "arg2", foo="bar")
        mock_notify_client.email.assert_called_once_with("arg1", "arg2", foo="bar")


class TestTaskclusterModelFactory:
    def test_returns_null_object_on_non_production(self):
        """Test taskcluster_model_factory returns stub on non-production environment."""
        notify = taskcluster_model_factory()
        assert isinstance(notify, TaskclusterModelNullObject)

    def test_returns_real_client_on_production(self, mock_tc_prod_backfill_credentials):
        """Test taskcluster_model_factory returns implementation on production environment."""
        notify = taskcluster_model_factory()
        assert isinstance(notify, TaskclusterModelImpl)


class TestNotifyClientFactory:
    def test_returns_null_object_on_non_production(self):
        """Test notify_client_factory returns stub on non-production environment."""
        notify = notify_client_factory()
        assert isinstance(notify, NotifyNullObject)

    def test_returns_real_client_on_production(self, mock_tc_prod_notify_credentials):
        """Test notify_client_factory returns NotifyAdapter on production environment."""
        notify = notify_client_factory()
        assert isinstance(notify, NotifyAdapter)
