from treeherder.etl.taskcluster_pulse.handler import handle_task_defined


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
