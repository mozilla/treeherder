import logging
from unittest.mock import MagicMock

import pytest
from django.db.utils import OperationalError
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from treeherder.config.db_routing import (
    READ_REPLICA_APP_ALLOW_LIST,
    ReadReplicaMixin,
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


class _RecordingView(ReadReplicaMixin, APIView):
    """Test view that records the thread-local state at the moment it ran."""

    # Disable auth/permission so CSRF does not interfere with mixin tests.
    authentication_classes = []
    permission_classes = []

    raise_on_call = None  # set per-test
    call_count = 0
    saw_use_replica = []

    def get(self, request):
        type(self).call_count += 1
        type(self).saw_use_replica.append(getattr(_state, "use_replica", False))
        if type(self).raise_on_call and type(self).call_count <= type(self).raise_on_call:
            raise OperationalError("simulated replica failure")
        return Response({"ok": True})

    def post(self, request):
        type(self).call_count += 1
        type(self).saw_use_replica.append(getattr(_state, "use_replica", False))
        return Response({"ok": True})


@pytest.fixture
def reset_view():
    _RecordingView.raise_on_call = 0
    _RecordingView.call_count = 0
    _RecordingView.saw_use_replica = []
    yield


def test_mixin_flips_state_on_get(reset_view):
    factory = APIRequestFactory()
    view = _RecordingView.as_view()
    response = view(factory.get("/x"))
    assert response.status_code == 200
    assert _RecordingView.saw_use_replica == [True]
    assert not hasattr(_state, "use_replica")  # cleared after dispatch


def test_mixin_does_not_flip_state_on_post(reset_view):
    factory = APIRequestFactory()
    view = _RecordingView.as_view()
    response = view(factory.post("/x", data={}))
    assert response.status_code == 200
    assert _RecordingView.saw_use_replica == [False]


def test_mixin_clears_state_when_view_raises(reset_view):
    _RecordingView.raise_on_call = 99  # always raise
    factory = APIRequestFactory()
    view = _RecordingView.as_view()
    # The second dispatch (retry) also raises, so the OperationalError
    # propagates. The important thing is that _state is cleared.
    with pytest.raises(OperationalError):
        view(factory.get("/x"))
    assert not hasattr(_state, "use_replica")


def test_mixin_retries_once_on_operational_error(reset_view, caplog):
    _RecordingView.raise_on_call = 1  # fail first call, succeed second
    factory = APIRequestFactory()
    view = _RecordingView.as_view()
    with caplog.at_level(logging.WARNING):
        response = view(factory.get("/x"))
    assert response.status_code == 200
    assert _RecordingView.call_count == 2
    # First attempt had the flag, retry did not.
    assert _RecordingView.saw_use_replica == [True, False]
    # Fallback log emitted exactly once.
    assert any("db_routing_fallback" in rec.message for rec in caplog.records)


def test_mixin_retries_only_once(reset_view):
    _RecordingView.raise_on_call = 2  # fail twice
    factory = APIRequestFactory()
    view = _RecordingView.as_view()
    with pytest.raises(OperationalError):
        view(factory.get("/x"))
    assert _RecordingView.call_count == 2  # original + 1 retry


def test_mixin_is_noop_when_replica_alias_not_configured(reset_view, caplog):
    """When the kill switch is off (no replica alias), the mixin must not
    flip the thread-local and must not emit fallback logs on primary errors.
    """

    from django.db import connections

    _RecordingView.raise_on_call = 99  # always raise — simulates primary error
    factory = APIRequestFactory()
    view = _RecordingView.as_view()

    # Temporarily drop the replica alias from the connection handler so the
    # mixin sees the kill switch as off.
    saved = connections.databases.pop("read_replica")
    try:
        with caplog.at_level(logging.WARNING):
            with pytest.raises(OperationalError):
                view(factory.get("/x"))
    finally:
        connections.databases["read_replica"] = saved

    # Mixin did not flip the thread-local (no replica to route to).
    assert _RecordingView.saw_use_replica == [False]
    # Mixin did not retry — one call only, not two.
    assert _RecordingView.call_count == 1
    # No misleading fallback log.
    assert not any("db_routing_fallback" in rec.message for rec in caplog.records)
