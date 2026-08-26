import json

import pytest

from treeherder.perf.models import BackfillRecord, BackfillReport
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
