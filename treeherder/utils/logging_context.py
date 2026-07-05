"""Centralized logging context for attaching structured labels to log records.

Metadata (task_id, run_id, job_id, component) is set once at a task or ingestion
boundary via ``log_context(...)`` and automatically propagates to every log
record emitted within that scope. ``apply_context_labels`` copies the active
labels onto a record so a GCP-structured handler can promote them to queryable
Cloud Logging labels (see ``treeherder.utils.gcp_logging``).
"""

import contextlib
from contextvars import ContextVar

from django.core.exceptions import ObjectDoesNotExist

# Holds the labels active for the current thread / async task. Never mutated in
# place; each ``log_context`` sets a fresh dict and restores the prior one.
_log_labels: ContextVar[dict] = ContextVar("log_labels", default={})


def get_log_labels() -> dict:
    """Return a copy of the labels active in the current context."""
    return dict(_log_labels.get())


@contextlib.contextmanager
def log_context(**labels):
    """Merge ``labels`` onto the active context for the duration of the block.

    ``None`` values are ignored. Usable as a context manager or a decorator.
    Nested contexts compose; the previous labels are restored on exit.
    """
    merged = {**_log_labels.get(), **{k: v for k, v in labels.items() if v is not None}}
    token = _log_labels.set(merged)
    try:
        yield
    finally:
        _log_labels.reset(token)


def job_log_labels(job) -> dict:
    """Resolve GCP labels for a Job: task_id, run_id and job_id.

    task_id/run_id are omitted for jobs without Taskcluster metadata (e.g.
    non-Taskcluster or not-yet-ingested jobs).
    """
    labels = {"job_id": str(job.id)}
    try:
        metadata = job.taskcluster_metadata
    except ObjectDoesNotExist:
        return labels
    labels["task_id"] = metadata.task_id
    labels["run_id"] = str(metadata.retry_id)
    return labels


def apply_context_labels(record):
    """Merge the active context labels onto ``record.labels`` in place.

    Labels set explicitly on the record (via ``extra={"labels": ...}``) take
    precedence over ambient context labels. Returns the record.
    """
    context = get_log_labels()
    if context:
        existing = getattr(record, "labels", {}) or {}
        record.labels = {**context, **existing}
    return record
