import json

import jsonschema
import pytest

from treeherder.etl.schema import get_json_schema
from treeherder.etl.taskcluster_pulse import handler as tc_handler
from treeherder.etl.taskcluster_pulse.handler import (
    build_message,
    get_test_manifest_info,
    handle_message,
    handle_task_defined,
)
from treeherder.utils.logging_context import get_log_labels


@pytest.mark.asyncio
async def test_handle_message_routes_task_defined():
    task = {
        "metadata": {
            "name": "test-task",
            "description": "Test task",
            "owner": "test@example.com",
        },
        "created": "2025-01-01T00:00:00.000Z",
        "workerType": "test-worker",
        "tags": {},
        "routes": ["tc-treeherder.v2.autoland.abc123"],
        "extra": {
            "treeherder": {
                "symbol": "T",
                "tier": 1,
            }
        },
    }

    message = {
        "exchange": "exchange/taskcluster-queue/v1/task-defined",
        "root_url": "https://firefox-ci-tc.services.mozilla.com",
        "payload": {
            "runId": 0,
            "status": {
                "taskId": "AJBb7wqZT6K9kz4niYAatg",
                "state": "unscheduled",
                "runs": [],
            },
        },
    }

    result = await handle_message(message, task)

    assert len(result) == 1
    assert result[0]["state"] == "unscheduled"
    assert result[0]["result"] == "unknown"


@pytest.mark.asyncio
async def test_handle_message_sets_log_context(monkeypatch):
    """handle_message wraps processing in a log_context carrying task_id/run_id."""
    captured = {}

    def capture_labels(*args, **kwargs):
        captured.update(get_log_labels())
        return {"state": "unscheduled", "result": "unknown"}

    monkeypatch.setattr(tc_handler, "handle_task_defined", capture_labels)

    task = {
        "metadata": {"name": "t", "description": "d", "owner": "o@example.com"},
        "created": "2025-01-01T00:00:00.000Z",
        "workerType": "test-worker",
        "tags": {},
        "routes": ["tc-treeherder.v2.autoland.abc123"],
        "extra": {"treeherder": {"symbol": "T", "tier": 1}},
    }
    message = {
        "exchange": "exchange/taskcluster-queue/v1/task-defined",
        "root_url": "https://firefox-ci-tc.services.mozilla.com",
        "payload": {
            "runId": 0,
            "status": {"taskId": "AJBb7wqZT6K9kz4niYAatg", "state": "unscheduled", "runs": []},
        },
    }

    await handle_message(message, task)

    assert captured == {
        "task_id": "AJBb7wqZT6K9kz4niYAatg",
        "run_id": "0",
        "component": "ingestion",
    }
    # context is cleaned up after the handler returns
    assert get_log_labels() == {}


def test_handle_task_defined():
    push_info = {
        "project": "autoland",
        "revision": "abc123",
        "origin": "hg.mozilla.org",
        "id": "12345",
    }

    task = {
        "metadata": {
            "name": "test-task",
            "description": "Test task",
            "owner": "test@example.com",
        },
        "created": "2025-01-01T00:00:00.000Z",
        "workerType": "test-worker",
        "tags": {},
        "extra": {
            "treeherder": {
                "symbol": "T",
                "tier": 1,
            }
        },
    }

    message = {
        "exchange": "exchange/taskcluster-queue/v1/task-defined",
        "payload": {
            "status": {
                "taskId": "AJBb7wqZT6K9kz4niYAatg",
                "state": "unscheduled",
                "runs": [],
            },
        },
    }

    result = handle_task_defined(push_info, task, message)

    assert result is not None
    assert isinstance(result, dict)
    assert result["buildMachine"]["name"] == "unknown"
    assert result["origin"]["project"] == "autoland"


def _test_task(test_paths=None, chunks=None):
    task = {
        "metadata": {
            "name": "test-linux2404-64/opt-mochitest-browser-chrome-1",
            "description": "Test task",
            "owner": "test@example.com",
        },
        "created": "2025-01-01T00:00:00.000Z",
        "workerType": "test-worker",
        "tags": {},
        "payload": {"env": {}},
        "extra": {"treeherder": {"symbol": "bc1", "tier": 1}},
    }
    if test_paths is not None:
        task["payload"]["env"]["MOZHARNESS_TEST_PATHS"] = test_paths
    if chunks is not None:
        task["extra"]["chunks"] = chunks
    return task


def test_get_test_manifest_info():
    task = _test_task(
        json.dumps({"mochitest-browser-chrome": ["b/browser.toml", "a/browser.toml"]}),
        chunks={"current": 1, "total": 13},
    )

    info = get_test_manifest_info(task)

    assert info["count"] == 2
    assert info["chunkTotal"] == 13
    assert len(info["hash"]) == 16


def test_get_test_manifest_info_hash_ignores_order_and_duplicates():
    a = _test_task(json.dumps({"bc": ["a.toml", "b.toml"], "mochitest-plain": ["c.toml"]}))
    b = _test_task(
        json.dumps({"mochitest-plain": ["c.toml"], "bc": ["b.toml", "a.toml", "a.toml"]})
    )

    assert get_test_manifest_info(a) == get_test_manifest_info(b)


def test_get_test_manifest_info_hash_differs_for_subset():
    full = _test_task(
        json.dumps({"bc": ["a.toml", "b.toml", "c.toml"]}), {"current": 1, "total": 2}
    )
    subset = _test_task(json.dumps({"bc": ["a.toml"]}), {"current": 1, "total": 2})

    full_info = get_test_manifest_info(full)
    subset_info = get_test_manifest_info(subset)

    assert full_info["hash"] != subset_info["hash"]
    assert (full_info["count"], subset_info["count"]) == (3, 1)


@pytest.mark.parametrize("test_paths", [None, "", "not json", '["a.toml"]'])
def test_get_test_manifest_info_without_usable_test_paths(test_paths):
    assert get_test_manifest_info(_test_task(test_paths)) is None


def test_build_message_includes_valid_test_manifests():
    push_info = {"project": "autoland", "revision": "a" * 40, "id": 12345}
    task = _test_task(json.dumps({"bc": ["a.toml"]}), chunks={"current": 1, "total": 4})
    payload = {
        "status": {
            "taskId": "AJBb7wqZT6K9kz4niYAatg",
            "runs": [{"runId": 0, "state": "pending"}],
        },
    }

    job = build_message(push_info, task, 0, payload)

    assert job["testManifests"]["count"] == 1
    assert job["testManifests"]["chunkTotal"] == 4
    jsonschema.validate(job, get_json_schema("pulse-job.yml"))


def test_build_message_omits_test_manifests_for_non_test_tasks():
    push_info = {"project": "autoland", "revision": "abc123", "id": "12345"}
    payload = {
        "status": {
            "taskId": "AJBb7wqZT6K9kz4niYAatg",
            "runs": [{"runId": 0, "state": "pending"}],
        },
    }

    job = build_message(push_info, _test_task(), 0, payload)

    assert "testManifests" not in job
