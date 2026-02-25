from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from treeherder.etl.taskcluster_pulse.handler import (
    PulseHandlerError,
    handle_message,
    handle_task_defined,
    parse_route_info,
)
from treeherder.model.models import Repository, RepositoryGroup


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
        "routes": ["tc-treeherder.v1.autoland.abc123"],
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

    mock_repo = MagicMock()
    mock_repo.name = "autoland"
    mock_push_info = {
        "version": "v1",
        "project": "autoland",
        "revision": "abc123",
        "id": 0,
        "repository": mock_repo,
    }

    with patch(
        "treeherder.etl.taskcluster_pulse.handler.parse_route_info",
        return_value=mock_push_info,
    ):
        result = await handle_message(message, task)

    assert len(result) == 1
    assert result[0]["state"] == "unscheduled"
    assert result[0]["result"] == "unknown"


@pytest.mark.asyncio
async def test_handle_message_routes_task_defined_v2():
    task = {
        "metadata": {
            "name": "test-task",
            "description": "Test task",
            "owner": "test@example.com",
        },
        "created": "2025-01-01T00:00:00.000Z",
        "workerType": "test-worker",
        "tags": {},
        "routes": ["tc-treeherder.v2.firefox-ci.enterprise-firefox.enterprise-main.abc123.999"],
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

    mock_repo = MagicMock()
    mock_repo.name = "enterprise-main"
    mock_push_info = {
        "version": "v2",
        "trust_domain": "firefox-ci",
        "project": "enterprise-firefox",
        "branch": "enterprise-main",
        "revision": "abc123",
        "id": 999,
        "repository": mock_repo,
    }

    with (
        patch(
            "treeherder.etl.taskcluster_pulse.handler.parse_route_info",
            return_value=mock_push_info,
        ),
        patch(
            "treeherder.etl.taskcluster_pulse.handler.ignore_task",
            return_value=False,
        ),
    ):
        result = await handle_message(message, task)

    assert len(result) == 1
    assert result[0]["state"] == "unscheduled"
    assert result[0]["result"] == "unknown"
    assert result[0]["origin"]["project"] == "enterprise-main"


def test_handle_task_defined():
    push_info = {
        "project": "autoland",
        "revision": "abc123",
        "origin": "hg.mozilla.org",
        "id": "12345",
        "repository": SimpleNamespace(name="autoland"),
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


@pytest.fixture
def autoland_repository(transactional_db):
    rg = RepositoryGroup.objects.create(name="test-group", description="")
    return Repository.objects.create(
        name="autoland",
        repository_group=rg,
        dvcs_type="hg",
        url="https://hg.mozilla.org/integration/autoland",
        branch="default",
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )


@pytest.mark.asyncio
async def test_handle_message_real_db_path(autoland_repository):
    task = {
        "metadata": {
            "name": "test-task",
            "description": "Test task",
            "owner": "test@example.com",
        },
        "created": "2025-01-01T00:00:00.000Z",
        "workerType": "test-worker",
        "tags": {},
        "routes": ["tc-treeherder.v1.autoland.abc123"],
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


@pytest.fixture
def repository_group(db):
    return RepositoryGroup.objects.create(name="test-group", description="")


@pytest.mark.parametrize(
    "repo_name,route_suffix",
    [
        ("mozilla-central", "mozilla-central.abc123def456.789"),
        ("fenix", "fenix.abc123def456.456"),
    ],
)
def test_parse_route_info_v1(db, repository_group, repo_name, route_suffix):
    repository = Repository.objects.create(
        name=repo_name,
        repository_group=repository_group,
        dvcs_type="hg" if repo_name == "mozilla-central" else "git",
        url=f"https://example.com/{repo_name}",
        branch="default" if repo_name == "mozilla-central" else "main",
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )

    result = parse_route_info(
        "tc-treeherder", "test-task", [f"tc-treeherder.v1.{route_suffix}"], {}
    )

    assert result["version"] == "v1"
    assert result["project"] == repo_name
    assert result["repository"] == repository


def test_parse_route_info_v1_with_owner(db, repository_group):
    repository = Repository.objects.create(
        name="fenix",
        repository_group=repository_group,
        dvcs_type="git",
        url="https://github.com/mozilla-mobile/fenix",
        branch="main",
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )

    result = parse_route_info(
        "tc-treeherder", "test-task", ["tc-treeherder.v1.mozilla-mobile/fenix.abc123def456.123"], {}
    )

    assert result["version"] == "v1"
    assert result["project"] == "fenix"
    assert result["repository"] == repository


def test_parse_route_info_v2(db, repository_group):
    repository = Repository.objects.create(
        name="enterprise-main",
        repository_group=repository_group,
        dvcs_type="git",
        url="https://github.com/mozilla/enterprise-firefox",
        branch="enterprise-main",
        trust_domain="firefox-ci",
        project="enterprise-firefox",
        tc_root_url="https://firefox-ci-tc.services.mozilla.com",
    )

    result = parse_route_info(
        "tc-treeherder",
        "test-task",
        ["tc-treeherder.v2.firefox-ci.enterprise-firefox.enterprise-main.abc123def456.999"],
        {},
    )

    assert result["version"] == "v2"
    assert result["trust_domain"] == "firefox-ci"
    assert result["project"] == "enterprise-firefox"
    assert result["branch"] == "enterprise-main"
    assert result["revision"] == "abc123def456"
    assert result["id"] == 999
    assert result["repository"] == repository


def test_parse_route_info_repository_not_found(db):
    with pytest.raises(PulseHandlerError, match="Could not find repository"):
        parse_route_info(
            "tc-treeherder", "test-task", ["tc-treeherder.v1.nonexistent.abc123.456"], {}
        )


@pytest.mark.parametrize(
    "routes,expected_error",
    [
        (["some.other.route", "another.route"], "Could not determine Treeherder route"),
        (
            ["tc-treeherder.v1.mozilla-central.abc123.456", "tc-treeherder.v1.try.def456.789"],
            "Could not determine Treeherder route",
        ),
        (["tc-treeherder.v1.too-short"], "Could not parse route"),
    ],
)
def test_parse_route_info_invalid_routes(routes, expected_error):
    task = {"taskId": "test-task-invalid"}

    with pytest.raises(PulseHandlerError) as exc_info:
        parse_route_info("tc-treeherder", "test-task-invalid", routes, task)

    assert expected_error in str(exc_info.value)
