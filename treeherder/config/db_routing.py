"""Read-only replica routing.

A thread-local flag, set by :class:`ReadReplicaMixin`, opts a single request
into reading from the ``read_replica`` database alias. The router only routes
models whose Django app label is in :data:`READ_REPLICA_APP_ALLOW_LIST`.

Design: .claude/plans/READ_REPLICA_DESIGN.md
"""

from __future__ import annotations

import logging
import threading

from django.db import connections
from django.db.utils import InterfaceError, OperationalError

# Apps whose models are eligible for replica reads when the thread-local is
# set. Allow-list (not deny-list) so opting new code in is an explicit choice.
READ_REPLICA_APP_ALLOW_LIST: frozenset[str] = frozenset({"perf", "model"})

_state = threading.local()

logger = logging.getLogger(__name__)

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class ReadReplicaRouter:
    """Route reads to ``read_replica`` when the thread-local flag is set."""

    def db_for_read(self, model, **hints):
        if not getattr(_state, "use_replica", False):
            return None
        if model._meta.app_label not in READ_REPLICA_APP_ALLOW_LIST:
            return None
        return "read_replica"

    def db_for_write(self, model, **hints):
        # Writes never go to the replica.
        return None

    def allow_relation(self, obj1, obj2, **hints):
        dbs = {obj1._state.db, obj2._state.db}
        if dbs <= {"default", "read_replica"}:
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        # Never run migrations against the replica.
        if db == "read_replica":
            return False
        return None


class ReadReplicaMixin:
    """Opt a view's safe HTTP methods into reading from ``read_replica``.

    For GET/HEAD/OPTIONS, the thread-local flag is set before ``dispatch``
    runs and cleared in a ``finally``. On :class:`OperationalError` or
    :class:`InterfaceError`, the request is retried once against the primary;
    further failures propagate.
    """

    def handle_exception(self, exc):
        # DRF's APIView.dispatch() wraps handler calls in a try/except that
        # routes exceptions through handle_exception, which would swallow
        # OperationalError/InterfaceError as a 500 response. Re-raise them
        # here so the outer try/except in our dispatch() can trigger the
        # fallback retry.
        if isinstance(exc, OperationalError | InterfaceError):
            raise exc
        return super().handle_exception(exc)

    def dispatch(self, request, *args, **kwargs):
        if request.method not in _SAFE_METHODS:
            return super().dispatch(request, *args, **kwargs)

        _state.use_replica = True
        try:
            try:
                return super().dispatch(request, *args, **kwargs)
            except (OperationalError, InterfaceError) as exc:
                logger.warning(
                    "db_routing_fallback path=%s method=%s exception_type=%s",
                    request.path,
                    request.method,
                    type(exc).__name__,
                )
                # Drop the (likely bad) replica connection before retrying.
                try:
                    connections["read_replica"].close()
                except Exception:
                    pass
                _state.use_replica = False
                return super().dispatch(request, *args, **kwargs)
        finally:
            if hasattr(_state, "use_replica"):
                del _state.use_replica
