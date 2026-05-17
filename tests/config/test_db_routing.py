from unittest.mock import MagicMock

import pytest

from treeherder.config.db_routing import (
    READ_REPLICA_APP_ALLOW_LIST,
    ReadReplicaRouter,
    _state,
)


@pytest.fixture(autouse=True)
def clear_state():
    """Ensure the thread-local is clean before and after every test."""
    if hasattr(_state, "use_replica"):
        del _state.use_replica
    yield
    if hasattr(_state, "use_replica"):
        del _state.use_replica


def _model(app_label):
    m = MagicMock()
    m._meta.app_label = app_label
    return m


def test_db_for_read_returns_replica_when_state_set_and_app_allowed():
    _state.use_replica = True
    router = ReadReplicaRouter()
    assert router.db_for_read(_model("perf")) == "read_replica"
    assert router.db_for_read(_model("model")) == "read_replica"


def test_db_for_read_returns_none_when_state_unset():
    router = ReadReplicaRouter()
    assert router.db_for_read(_model("perf")) is None


def test_db_for_read_returns_none_for_unlisted_app_even_when_state_set():
    _state.use_replica = True
    router = ReadReplicaRouter()
    # Auth and sessions must always read from primary.
    assert router.db_for_read(_model("auth")) is None
    assert router.db_for_read(_model("sessions")) is None
    assert router.db_for_read(_model("etl")) is None


def test_db_for_write_always_returns_none():
    _state.use_replica = True
    router = ReadReplicaRouter()
    assert router.db_for_write(_model("perf")) is None
    assert router.db_for_write(_model("model")) is None


def test_allow_relation_true_between_default_and_replica():
    router = ReadReplicaRouter()
    a, b = MagicMock(), MagicMock()
    a._state.db = "default"
    b._state.db = "read_replica"
    assert router.allow_relation(a, b) is True
    b._state.db = "default"
    a._state.db = "read_replica"
    assert router.allow_relation(a, b) is True


def test_allow_migrate_blocks_replica():
    router = ReadReplicaRouter()
    assert router.allow_migrate("read_replica", "perf") is False
    assert router.allow_migrate("default", "perf") is None
    assert router.allow_migrate("default", "auth") is None


def test_allow_list_is_perf_and_model():
    assert READ_REPLICA_APP_ALLOW_LIST == {"perf", "model"}
