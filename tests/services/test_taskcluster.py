import pytest

from tests.conftest import SampleDataJSONLoader
from treeherder.services.taskcluster import (
    TaskclusterModelImpl,
    notify_client_factory,
    NotifyNullObject,
    NotifyAdapter,
)

load_json_fixture = SampleDataJSONLoader('perf_sheriff_bot')


@pytest.fixture(scope="module")
def actions_json():
    return load_json_fixture('initialActions.json')


@pytest.fixture(scope="module")
def expected_actions_json():
    return load_json_fixture('reducedActions.json')


@pytest.fixture(scope="module")
def original_task():
    return load_json_fixture('originalTask.json')


@pytest.fixture(scope="module")
def expected_backfill_task():
    return load_json_fixture('backfillTask.json')


class TestTaskclusterModelImpl:
    FAKE_ROOT_URL = 'https://fakerooturl.org'
    FAKE_OPTIONS = (FAKE_ROOT_URL, 'FAKE_CLIENT_ID', 'FAKE_ACCESS_TOKEN')

    def test_can_instantiate_without_credentials(self):
        try:
            _ = TaskclusterModelImpl(self.FAKE_ROOT_URL, unit_testing_this=True)
        except ValueError:
            pytest.fail(
                "Should be able to instantiate TaskclusterModelImpl without providing credentials."
            )

    # TODO: remove when backfill tool' soft launch is complete ->
    def test_cannot_instantiate_on_production(self):
        with pytest.raises(RuntimeError):
            _ = TaskclusterModelImpl(*self.FAKE_OPTIONS)

    def test_can_still_instantiate_when_testing(self):
        try:
            _ = TaskclusterModelImpl(
                *self.FAKE_OPTIONS,
                unit_testing_this=True,
            )
        except RuntimeError:
            pytest.fail("We should be able to instantiate TaskclusterModelImpl when testing")

    # <- up to here

    def test_filter_relevant_actions(self, actions_json, original_task, expected_actions_json):
        reduced_actions_json = TaskclusterModelImpl._filter_relevant_actions(
            actions_json, original_task
        )

        assert reduced_actions_json == expected_actions_json

    def test_task_in_context(self):
        # match
        tag_set_list, task_tags = [
            load_json_fixture(f) for f in ("matchingTagSetList.json", "matchingTaskTags.json")
        ]
        assert TaskclusterModelImpl._task_in_context(tag_set_list, task_tags) is True

        # mismatch
        tag_set_list, task_tags = [
            load_json_fixture(f) for f in ("mismatchingTagSetList.json", "mismatchingTaskTags.json")
        ]
        assert TaskclusterModelImpl._task_in_context(tag_set_list, task_tags) is False

    def test_get_action(self, actions_json, expected_backfill_task):
        action_array = actions_json["actions"]

        backfill_task = TaskclusterModelImpl._get_action(action_array, "backfill")
        assert backfill_task == expected_backfill_task


class TestNotifyClientFactory:
    def test_returns_null_object_on_non_production(self):
        notify = notify_client_factory()
        assert isinstance(notify, NotifyNullObject)

    def test_returns_real_client_on_production(self, mock_tc_prod_credentials):
        notify = notify_client_factory()
        assert isinstance(notify, NotifyAdapter)
