import json
from datetime import timedelta

import pytest
from django.utils import timezone

from treeherder.model.models import Push
from treeherder.perf.models import (
    BackfilledPush,
    BackfillRecord,
    BackfillReport,
    BackfillRequest,
)
from treeherder.webapp.api.performance_serializers import BackfillRecordSerializer


@pytest.fixture
def backfill_record_with_logs(test_perf_alert):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(alert=test_perf_alert, report=report)
    record.backfill_logs = json.dumps(
        [
            {
                "iteration": 0,
                "status": "initial",
                "detected_push_id": 111,
                "detected_push_revision": "aaaa1111bbbb",
            },
            {"iteration": 0, "status": "backfill_requested"},  # no push → must be skipped
            {
                "iteration": 1,
                "status": "right",
                "detected_push_id": 222,
                "detected_push_revision": "cccc2222dddd",
            },
        ]
    )
    record.save()
    return record


@pytest.mark.django_db
def test_get_latest_detected_push_returns_most_recent(backfill_record_with_logs):
    assert backfill_record_with_logs.get_latest_detected_push() == {
        "detected_push_id": 222,
        "detected_push_revision": "cccc2222dddd",
    }


@pytest.mark.django_db
def test_serializer_exposes_detected_push(backfill_record_with_logs):
    data = BackfillRecordSerializer(backfill_record_with_logs).data
    assert data["detected_push_id"] == 222
    assert data["detected_push_revision"] == "cccc2222dddd"


@pytest.mark.django_db
def test_detected_push_null_when_no_logs(test_perf_alert):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(
        alert=test_perf_alert, report=report
    )  # backfill_logs='[]'
    data = BackfillRecordSerializer(record).data
    assert data["detected_push_id"] is None
    assert data["detected_push_revision"] is None


@pytest.mark.django_db
def test_detected_push_falls_back_to_scalar(test_perf_alert):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(
        alert=test_perf_alert, report=report, last_detected_push_id=999
    )
    assert record.get_latest_detected_push() == {
        "detected_push_id": 999,
        "detected_push_revision": None,
    }


@pytest.mark.django_db
def test_detected_push_revision_is_none_when_key_absent(test_perf_alert):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(alert=test_perf_alert, report=report)
    record.backfill_logs = json.dumps(
        [
            {
                "iteration": 0,
                "status": "initial",
                "detected_push_id": 111,
                # no "detected_push_revision" key — old/legacy log format
            }
        ]
    )
    record.save()
    result = record.get_latest_detected_push()
    assert result["detected_push_id"] == 111
    assert result["detected_push_revision"] is None


@pytest.mark.django_db
def test_failed_jobs_count_follows_job_task_ids(test_perf_alert, test_jobs):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(alert=test_perf_alert, report=report)
    record.backfill_logs = json.dumps(
        [{"iteration": 1, "status": "backfill_requested", "job_task_ids": {"1": "bk-task"}}]
    )
    record.save()

    def create_backfilled_push(bk_task_id, job, result, state="completed", age_hours=0):
        job.result = result
        job.state = state
        job.save()
        request, _ = BackfillRequest.objects.get_or_create(
            bk_task_id=bk_task_id, push=job.push, repository=job.repository
        )
        bp = BackfilledPush.objects.create(
            backfill_request=request, push=job.push, decision_task_id="d", job=job
        )
        # created is auto_now_add, so backdate it with an update
        BackfilledPush.objects.filter(id=bp.id).update(
            created=timezone.now() - timedelta(hours=age_hours)
        )

    create_backfilled_push("bk-task", test_jobs[0], "testfailed")
    create_backfilled_push("bk-task", test_jobs[1], "busted")
    create_backfilled_push("bk-task", test_jobs[2], "success")
    # never ran (e.g. its build failed): counted only once 72h have passed
    create_backfilled_push("bk-task", test_jobs[3], "unknown", state="unscheduled", age_hours=73)
    create_backfilled_push("bk-task", test_jobs[4], "unknown", state="unscheduled", age_hours=1)
    # failed, but belongs to a backfill not referenced by this record
    create_backfilled_push("other-task", test_jobs[5], "testfailed")
    # no job: counted when the trigger failed, not when the push was skipped
    request = BackfillRequest.objects.filter(bk_task_id="bk-task").first()
    free_pushes = Push.objects.exclude(id__in=request.backfilled_pushes.values("push_id"))
    for push, status in zip(free_pushes, (BackfilledPush.FAILED, BackfilledPush.SKIPPED)):
        BackfilledPush.objects.create(
            backfill_request=request, push=push, decision_task_id="d", status=status
        )

    assert BackfillRecordSerializer(record).data["failed_jobs_count"] == 4


@pytest.mark.django_db
def test_failed_jobs_count_zero_without_job_task_ids(backfill_record_with_logs):
    assert BackfillRecordSerializer(backfill_record_with_logs).data["failed_jobs_count"] == 0
