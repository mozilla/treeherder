import pytest

from treeherder.etl.taskcluster_pulse import handler as tc_handler
from treeherder.etl.taskcluster_pulse.handler import handle_message, handle_task_defined
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
