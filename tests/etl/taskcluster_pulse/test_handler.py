import pytest

from treeherder.etl.taskcluster_pulse.handler import (
    create_log_reference,
    handle_message,
    handle_task_defined,
)

ROOT_URL = "https://firefox-ci-tc.services.mozilla.com"
TASK_ID = "AJBb7wqZT6K9kz4niYAatg"


def test_create_log_reference_emits_live_backing_log_by_default():
    logs = create_log_reference(ROOT_URL, TASK_ID, 0)
    assert len(logs) == 1
    assert logs[0]["name"] == "live_backing_log"
    assert logs[0]["url"].endswith(f"task/{TASK_ID}/runs/0/artifacts/public/logs/live_backing.log")


def test_create_log_reference_only_live_backing_log_when_no_raw_log():
    artifacts = [
        {"name": "public/logs/live_backing.log"},
        {"name": "public/test_info/something.txt"},
    ]
    logs = create_log_reference(ROOT_URL, TASK_ID, 0, artifacts=artifacts)
    assert len(logs) == 1
    assert logs[0]["url"].endswith("artifacts/public/logs/live_backing.log")


def test_create_log_reference_appends_raw_log_when_present():
    artifacts = [
        {"name": "public/logs/live_backing.log"},
        {"name": "public/test_info/xpcshell_raw.log"},
        {"name": "public/test_info/mochitest_raw.log"},
    ]
    logs = create_log_reference(ROOT_URL, TASK_ID, 0, artifacts=artifacts)
    assert [log["name"] for log in logs] == [
        "live_backing_log",
        "structured_log",
        "structured_log",
    ]
    urls = [log["url"] for log in logs]
    assert urls[0].endswith("artifacts/public/logs/live_backing.log")
    assert urls[1].endswith("artifacts/public/test_info/xpcshell_raw.log")
    assert urls[2].endswith("artifacts/public/test_info/mochitest_raw.log")


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
