import logging

import pytest

from treeherder.model import models as th_models
from treeherder.utils.logging_context import (
    apply_context_labels,
    get_log_labels,
    job_log_labels,
    log_context,
)


def make_record():
    return logging.LogRecord(
        name="treeherder.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello",
        args=(),
        exc_info=None,
    )


def test_get_log_labels_empty_outside_context():
    assert get_log_labels() == {}


def test_log_context_sets_labels():
    with log_context(task_id="ABC", run_id="0"):
        assert get_log_labels() == {"task_id": "ABC", "run_id": "0"}
    # restored after the block exits
    assert get_log_labels() == {}


def test_log_context_merges_and_restores_nested():
    with log_context(task_id="ABC", component="ingestion"):
        with log_context(run_id="2", component="failureline"):
            assert get_log_labels() == {
                "task_id": "ABC",
                "run_id": "2",
                "component": "failureline",
            }
        # inner block unwinds, outer labels remain
        assert get_log_labels() == {"task_id": "ABC", "component": "ingestion"}
    assert get_log_labels() == {}


def test_log_context_ignores_none_values():
    with log_context(task_id="ABC", run_id=None, job_id=None):
        assert get_log_labels() == {"task_id": "ABC"}


def test_get_log_labels_returns_a_copy():
    with log_context(task_id="ABC"):
        labels = get_log_labels()
        labels["task_id"] = "MUTATED"
        assert get_log_labels() == {"task_id": "ABC"}


def test_log_context_usable_as_decorator():
    @log_context(component="failureline")
    def do_work():
        return get_log_labels()

    assert do_work() == {"component": "failureline"}
    assert get_log_labels() == {}


def test_apply_context_labels_stashes_current_labels_on_record():
    record = make_record()
    with log_context(task_id="ABC", run_id="0"):
        apply_context_labels(record)
    assert record.labels == {"task_id": "ABC", "run_id": "0"}


def test_apply_context_labels_preserves_per_call_labels():
    record = make_record()
    # a label set explicitly on the call (via extra={"labels": ...}) wins over context
    record.labels = {"task_id": "EXPLICIT"}
    with log_context(task_id="CONTEXT", run_id="0"):
        apply_context_labels(record)
    assert record.labels == {"task_id": "EXPLICIT", "run_id": "0"}


def test_apply_context_labels_no_context_is_noop():
    record = make_record()
    apply_context_labels(record)
    assert getattr(record, "labels", {}) == {}


@pytest.mark.django_db
def test_job_log_labels_with_taskcluster_metadata(test_job):
    meta = test_job.taskcluster_metadata
    assert job_log_labels(test_job) == {
        "task_id": meta.task_id,
        "run_id": str(meta.retry_id),
        "job_id": str(test_job.id),
    }


@pytest.mark.django_db
def test_job_log_labels_without_metadata_omits_task_and_run(test_job):
    th_models.TaskclusterMetadata.objects.filter(job=test_job).delete()
    # re-fetch to drop the cached reverse relation
    job = th_models.Job.objects.get(id=test_job.id)
    assert job_log_labels(job) == {"job_id": str(job.id)}
