import pytest

from tests.conftest import SampleDataJSONLoader
from treeherder.services.taskcluster import TaskclusterModel

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
    return load_json_fixture('backfilltask.json')


# TaskclusterModel
def test_filter_relevant_actions(actions_json, original_task, expected_actions_json):
    reduced_actions_json = TaskclusterModel._filter_relevant_actions(actions_json, original_task)

    assert reduced_actions_json == expected_actions_json


def test_task_in_context():
    # match
    tag_set_list, task_tags = [
        load_json_fixture(f) for f in ("matchingTagSetList.json", "matchingTaskTags.json")
    ]
    assert TaskclusterModel._task_in_context(tag_set_list, task_tags) is True

    # mismatch
    tag_set_list, task_tags = [
        load_json_fixture(f) for f in ("mismatchingTagSetList.json", "mismatchingTaskTags.json")
    ]
    assert TaskclusterModel._task_in_context(tag_set_list, task_tags) is False


def test_get_action(actions_json, expected_backfill_task):
    action_array = actions_json["actions"]

    backfill_task = TaskclusterModel._get_action(action_array, "backfill")
    assert backfill_task == expected_backfill_task
