"""Read-only replica routing.

A thread-local flag, set by :class:`ReadReplicaMixin`, opts a single request
into reading from the ``read_replica`` database alias. The router only routes
models whose Django app label is in :data:`READ_REPLICA_APP_ALLOW_LIST`.

Design: .claude/plans/READ_REPLICA_DESIGN.md
"""

from __future__ import annotations

import threading

# Apps whose models are eligible for replica reads when the thread-local is
# set. Allow-list (not deny-list) so opting new code in is an explicit choice.
READ_REPLICA_APP_ALLOW_LIST: frozenset[str] = frozenset({"perf", "model"})

_state = threading.local()


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
