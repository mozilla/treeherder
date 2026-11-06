import copy
import json

import pytest
from django.urls import reverse

from tests.conftest import create_perf_alert
from treeherder.perf.models import (
    BackfillRecord,
    BackfillReport,
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceFramework,
)

pytestmark = pytest.mark.perf


def test_alerts_get(
    client,
    test_repository,
    test_perf_alert_with_tcmetadata,
    test_perf_datum,
    test_perf_datum_2,
):
    resp = client.get(reverse("performance-alerts-list"))
    assert resp.status_code == 200

    # should just have the one alert
    assert resp.json()["next"] is None
    assert resp.json()["previous"] is None
    assert len(resp.json()["results"]) == 1
    assert set(resp.json()["results"][0].keys()) == {
        "amount_pct",
        "amount_abs",
        "id",
        "is_regression",
        "starred",
        "manually_created",
        "new_value",
        "prev_value",
        "related_summary_id",
        "series_signature",
        "taskcluster_metadata",
        "prev_taskcluster_metadata",
        "profile_url",
        "prev_profile_url",
        "summary_id",
        "status",
        "t_value",
        "classifier",
        "classifier_email",
        "backfill_record",
        "side_by_side_available",
        "noise_profile",
        "severity",
    }
    assert resp.json()["results"][0]["related_summary_id"] is None
    assert set(resp.json()["results"][0]["taskcluster_metadata"].keys()) == {
        "task_id",
        "retry_id",
    }
    assert set(resp.json()["results"][0]["prev_taskcluster_metadata"].keys()) == {
        "task_id",
        "retry_id",
    }


def test_alerts_put(
    client,
    push_stored,
    test_repository,
    test_perf_datum,
    test_perf_datum_2,
    test_perf_alert,
    test_perf_alert_summary_2,
    test_user,
    test_sheriff,
):
    resp = client.get(reverse("performance-alerts-list"))
    assert resp.status_code == 200
    assert resp.json()["results"][0]["related_summary_id"] is None

    # verify that we fail if not authenticated
    resp = client.put(
        reverse("performance-alerts-list") + "update/",
        {"alert_ids": [1], "related_summary_id": 2, "status": PerformanceAlert.DOWNSTREAM},
        format="json",
    )
    assert resp.status_code == 403
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.put(
        reverse("performance-alerts-list") + "update/",
        {"alert_ids": [1], "related_summary_id": 2, "status": PerformanceAlert.DOWNSTREAM},
        format="json",
    )
    assert resp.status_code == 403
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we succeed if authenticated + staff
    client.force_authenticate(user=test_sheriff)
    resp = client.put(
        reverse("performance-alerts-list") + "update/",
        {"alert_ids": [1], "related_summary_id": 2, "status": PerformanceAlert.DOWNSTREAM},
        format="json",
    )
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id == 2
    assert PerformanceAlert.objects.get(id=1).classifier == test_sheriff

    # verify that we can unset it too
    resp = client.put(
        reverse("performance-alerts-list") + "update/",
        {"alert_ids": [1], "related_summary_id": None, "status": PerformanceAlert.UNTRIAGED},
        format="json",
    )
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None


def test_reassign_different_repository(
    authorized_sheriff_client,
    push_stored,
    test_repository,
    test_repository_2,
    test_perf_datum,
    test_perf_datum_2,
    test_perf_alert,
    test_perf_alert_summary_2,
    test_sheriff,
):
    # verify that we can't reassign to another performance alert summary
    # with a different repository unless the new status is downstream
    test_perf_alert_summary_2.repository = test_repository_2
    test_perf_alert_summary_2.save()

    assert_incompatible_alert_assignment_fails(
        authorized_sheriff_client, test_perf_alert, test_perf_alert_summary_2
    )

    # mark downstream of summary with different repository,
    # should succeed
    resp = authorized_sheriff_client.put(
        reverse("performance-alerts-list") + "update/",
        {
            "alert_ids": [1],
            "related_summary_id": test_perf_alert_summary_2.id,
            "status": PerformanceAlert.DOWNSTREAM,
        },
        format="json",
    )
    assert resp.status_code == 200
    test_perf_alert.refresh_from_db()
    assert test_perf_alert.related_summary_id == test_perf_alert_summary_2.id
    assert test_perf_alert.classifier == test_sheriff


def test_reassign_different_framework(
    authorized_sheriff_client,
    push_stored,
    test_repository,
    test_repository_2,
    test_perf_alert,
    test_perf_alert_summary_2,
):
    # verify that we can't reassign to another performance alert summary
    # with a different framework
    framework_2 = PerformanceFramework.objects.create(name="test_talos_2", enabled=True)
    test_perf_alert_summary_2.framework = framework_2
    test_perf_alert_summary_2.save()

    assert_incompatible_alert_assignment_fails(
        authorized_sheriff_client, test_perf_alert, test_perf_alert_summary_2
    )


def test_alerts_bulk_update(
    client,
    push_stored,
    test_repository,
    test_perf_datum,
    test_perf_datum_2,
    test_perf_alert,
    test_perf_signature_2,
    test_perf_alert_summary,
    test_perf_alert_summary_2,
    test_user,
    test_sheriff,
):
    second_alert = create_perf_alert(
        summary=test_perf_alert_summary, series_signature=test_perf_signature_2
    )
    alert_ids = [test_perf_alert.id, second_alert.id]
    url = reverse("performance-alerts-list") + "update/"
    reassign = {
        "alert_ids": alert_ids,
        "status": PerformanceAlert.REASSIGNED,
        "related_summary_id": test_perf_alert_summary_2.id,
    }

    resp = client.put(url, reassign, format="json")
    assert resp.status_code == 403
    client.force_authenticate(user=test_user)
    resp = client.put(url, reassign, format="json")
    assert resp.status_code == 403
    assert not PerformanceAlert.objects.filter(related_summary=test_perf_alert_summary_2).exists()

    client.force_authenticate(user=test_sheriff)
    resp = client.put(url, reassign, format="json")
    assert resp.status_code == 200
    assert resp.json() == {"alert_ids": sorted(alert_ids)}
    for alert in PerformanceAlert.objects.filter(id__in=alert_ids):
        assert alert.related_summary_id == test_perf_alert_summary_2.id
        assert alert.status == PerformanceAlert.REASSIGNED
        assert alert.classifier == test_sheriff
        assert alert.first_triaged is not None

    test_perf_alert_summary.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()
    assert test_perf_alert_summary.status == PerformanceAlertSummary.REASSIGNED
    assert test_perf_alert_summary_2.status == PerformanceAlertSummary.REASSIGNED
    assert test_perf_alert_summary_2.first_triaged is not None

    reset = {
        "alert_ids": alert_ids,
        "status": PerformanceAlert.UNTRIAGED,
        "related_summary_id": None,
    }
    resp = client.put(url, reset, format="json")
    assert resp.status_code == 200
    assert not PerformanceAlert.objects.filter(
        id__in=alert_ids, related_summary__isnull=False
    ).exists()
    test_perf_alert_summary.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()
    assert test_perf_alert_summary.status == PerformanceAlertSummary.UNTRIAGED
    assert test_perf_alert_summary_2.status == PerformanceAlertSummary.UNTRIAGED


def test_alerts_bulk_update_rejects_incompatible_summary(
    authorized_sheriff_client,
    push_stored,
    test_repository,
    test_perf_datum,
    test_perf_alert,
    test_perf_signature_2,
    test_perf_alert_summary,
    test_perf_alert_summary_2,
):
    framework_2 = PerformanceFramework.objects.create(name="test_talos_2", enabled=True)
    test_perf_alert_summary_2.framework = framework_2
    test_perf_alert_summary_2.save()
    second_alert = create_perf_alert(
        summary=test_perf_alert_summary, series_signature=test_perf_signature_2
    )
    alert_ids = [test_perf_alert.id, second_alert.id]

    resp = authorized_sheriff_client.put(
        reverse("performance-alerts-list") + "update/",
        {
            "alert_ids": alert_ids,
            "status": PerformanceAlert.REASSIGNED,
            "related_summary_id": test_perf_alert_summary_2.id,
        },
        format="json",
    )
    assert resp.status_code == 400
    for alert in PerformanceAlert.objects.filter(id__in=alert_ids):
        assert alert.related_summary_id is None
        assert alert.status == PerformanceAlert.UNTRIAGED


def test_alerts_bulk_update_rejects_unknown_ids_and_invalid_status(
    authorized_sheriff_client, test_perf_alert
):
    url = reverse("performance-alerts-list") + "update/"

    resp = authorized_sheriff_client.put(
        url,
        {"alert_ids": [test_perf_alert.id, 999999], "status": PerformanceAlert.ACKNOWLEDGED},
        format="json",
    )
    assert resp.status_code == 400

    resp = authorized_sheriff_client.put(
        url,
        {"alert_ids": [test_perf_alert.id], "status": PerformanceAlert.REASSIGNED},
        format="json",
    )
    assert resp.status_code == 400

    test_perf_alert.refresh_from_db()
    assert test_perf_alert.status == PerformanceAlert.UNTRIAGED

    resp = authorized_sheriff_client.put(url, {"alert_ids": [test_perf_alert.id]}, format="json")
    assert resp.status_code == 400


def test_alert_detail_update_is_removed(authorized_sheriff_client, test_perf_alert):
    resp = authorized_sheriff_client.put(
        reverse("performance-alerts-list") + "1/", {"starred": True}, format="json"
    )
    assert resp.status_code == 405


def assert_incompatible_alert_assignment_fails(
    authorized_sheriff_client, perf_alert, incompatible_summary
):
    resp = authorized_sheriff_client.put(
        reverse("performance-alerts-list") + "update/",
        {
            "alert_ids": [1],
            "related_summary_id": incompatible_summary.id,
            "status": PerformanceAlert.REASSIGNED,
        },
        format="json",
    )
    assert resp.status_code == 400
    perf_alert.refresh_from_db()
    assert perf_alert.related_summary_id is None
    assert perf_alert.status == PerformanceAlert.UNTRIAGED


@pytest.fixture
def alert_create_post_blob(test_perf_alert_summary, test_perf_signature):
    # this blob should be sufficient to create a new alert (assuming
    # the user of this API is authorized to do so!)
    return {"summary_id": test_perf_alert_summary.id, "signature_id": test_perf_signature.id}


def test_alerts_post(
    client, alert_create_post_blob, test_user, test_sheriff, generate_enough_perf_datum
):
    # verify that we fail if not authenticated
    resp = client.post(reverse("performance-alerts-list"), alert_create_post_blob)
    assert resp.status_code == 403

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.post(reverse("performance-alerts-list"), alert_create_post_blob)
    assert resp.status_code == 403
    assert PerformanceAlert.objects.count() == 0

    # verify that we succeed if staff + authenticated
    client.force_authenticate(user=test_sheriff)
    resp = client.post(reverse("performance-alerts-list"), alert_create_post_blob)
    assert resp.status_code == 200
    assert PerformanceAlert.objects.count() == 1

    alert = PerformanceAlert.objects.first()
    assert alert.status == PerformanceAlert.UNTRIAGED
    assert alert.manually_created
    assert alert.amount_pct == 100
    assert alert.amount_abs == 1
    assert alert.prev_value == 1
    assert alert.new_value == 2
    assert alert.is_regression
    assert alert.summary.id == 1


def test_alerts_post_insufficient_data(
    authorized_sheriff_client,
    test_repository,
    test_perf_alert_summary,
    test_perf_signature,
    alert_create_post_blob,
):
    # we should not succeed if insufficient data is passed through
    for removed_key in ["summary_id", "signature_id"]:
        new_post_blob = copy.copy(alert_create_post_blob)
        del new_post_blob[removed_key]

        resp = authorized_sheriff_client.post(reverse("performance-alerts-list"), new_post_blob)
        assert resp.status_code == 400
        assert PerformanceAlert.objects.count() == 0


def test_timestamps_on_alert_and_summaries_inside_code(
    test_perf_alert_summary, test_perf_signature, test_perf_signature_2
):
    new_alert = create_perf_alert(
        summary=test_perf_alert_summary, series_signature=test_perf_signature
    )

    assert new_alert.created <= new_alert.last_updated
    assert new_alert.first_triaged is None

    # update increases last_updated,
    # but created and first_triaged remain the same
    previous_create = new_alert.created
    previous_update = new_alert.last_updated
    new_alert.starred = True
    new_alert.save()

    assert previous_create == new_alert.created
    assert previous_update < new_alert.last_updated
    assert new_alert.first_triaged is None  # non-human interaction doesn't update this field

    # parent summary doesn't update first_triaged
    # on alert.save()
    parent_summary = new_alert.summary
    parent_summary.refresh_from_db()

    assert parent_summary.first_triaged is None
    # but it does update on
    # alert.timestamp_first_triage()
    new_alert.timestamp_first_triage().save()
    parent_summary.refresh_from_db()

    assert parent_summary.first_triaged is not None


def test_timestamps_on_manual_created_alert_via_their_endpoints(
    authorized_sheriff_client, alert_create_post_blob, generate_enough_perf_datum
):
    # created <= last_updated, created <= first_triaged
    # BUT manually_created is True
    resp = authorized_sheriff_client.post(
        reverse("performance-alerts-list"), alert_create_post_blob
    )
    assert resp.status_code == 200

    manual_alert_id = resp.json()["alert_id"]
    manual_alert = PerformanceAlert.objects.get(pk=manual_alert_id)
    assert manual_alert.manually_created is True
    assert manual_alert.summary.first_triaged is not None

    assert manual_alert.created <= manual_alert.last_updated
    assert manual_alert.first_triaged is not None
    assert manual_alert.created <= manual_alert.first_triaged


def test_alert_timestamps_via_endpoint(
    authorized_sheriff_client,
    test_sheriff,
    test_perf_datum,
    test_perf_datum_2,
    test_perf_alert,
):
    # updating autogenerated alert:
    # created doesn't change, last_updated & first_triaged update
    old_created = test_perf_alert.created
    old_last_updated = test_perf_alert.last_updated

    resp = authorized_sheriff_client.put(
        reverse("performance-alerts-list") + "update/",
        {"alert_ids": [1], "starred": True},
        format="json",
    )
    assert resp.status_code == 200
    test_perf_alert.refresh_from_db()
    # starring alone leaves the status untouched
    assert test_perf_alert.starred is True
    assert test_perf_alert.status == PerformanceAlert.UNTRIAGED

    assert test_perf_alert.created == old_created
    assert test_perf_alert.first_triaged is not None
    assert test_perf_alert.created < test_perf_alert.first_triaged
    assert test_perf_alert.last_updated > old_last_updated

    old_first_triaged = test_perf_alert.first_triaged
    old_last_updated = test_perf_alert.last_updated

    # updating alert multiple times:
    # keeps first_triaged the same
    authorized_sheriff_client.force_authenticate(user=test_sheriff)
    resp = authorized_sheriff_client.put(
        reverse("performance-alerts-list") + "update/",
        {"alert_ids": [1], "status": PerformanceAlert.ACKNOWLEDGED},
        format="json",
    )
    assert resp.status_code == 200
    test_perf_alert.refresh_from_db()

    assert test_perf_alert.first_triaged == old_first_triaged
    assert test_perf_alert.last_updated > old_last_updated


@pytest.mark.parametrize("relation", [PerformanceAlert.DOWNSTREAM, PerformanceAlert.REASSIGNED])
def test_related_alerts_timestamps_via_endpoint(
    authorized_sheriff_client,
    test_sheriff,
    test_perf_datum,
    test_perf_datum_2,
    test_perf_alert,
    relation,
    test_perf_alert_summary,
    test_perf_alert_summary_2,
):
    # downstream/reassign use case
    assert test_perf_alert.first_triaged is None
    assert test_perf_alert_summary.first_triaged is None
    assert test_perf_alert_summary_2.first_triaged is None

    old_alert_last_updated = test_perf_alert.last_updated
    old_summary_last_updated = test_perf_alert_summary.last_updated
    old_summary_last_updated_2 = test_perf_alert_summary_2.last_updated

    resp = authorized_sheriff_client.put(
        reverse("performance-alerts-list") + "update/",
        {
            "alert_ids": [1],
            "status": relation,
            "related_summary_id": test_perf_alert_summary_2.id,
        },
        format="json",
    )
    assert resp.status_code == 200
    test_perf_alert.refresh_from_db()
    test_perf_alert_summary.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()

    assert test_perf_alert.first_triaged is not None
    assert test_perf_alert_summary.first_triaged is not None
    assert test_perf_alert_summary_2.first_triaged is not None

    assert test_perf_alert.last_updated > old_alert_last_updated
    assert test_perf_alert_summary.last_updated > old_summary_last_updated
    assert test_perf_alert_summary_2.last_updated > old_summary_last_updated_2


# utils
def dump_vars(alert_summaries, perf_data, alerts=None):
    from pprint import pprint

    def dump(an_alert):
        pprint(
            f"Alert("
            f"id={an_alert.id}, "
            f"summary_id={an_alert.summary_id}, "
            f"push_id={an_alert.summary.push_id}, "
            f"prev_push_id={an_alert.summary.prev_push_id}"
            f")"
        )

    for summary in alert_summaries:
        pprint(
            f"AlertSummary("
            f"id={summary.id}, push_id={summary.push_id}, prev_push_id={summary.prev_push_id}) has following alerts: "
        )
        for alert in summary.alerts.all():
            dump(alert)
    if alerts is not None:
        for alert in alerts:
            dump(alert)
    for perf_datum in perf_data:
        pprint(f"PerfData(id={perf_datum.push_id}, push_timestamp={perf_datum.push_timestamp})")


@pytest.mark.django_db
def test_alerts_list_exposes_detected_push_in_backfill_record(
    client,
    test_perf_alert,
):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(alert=test_perf_alert, report=report)
    record.backfill_logs = json.dumps(
        [
            {
                "iteration": 0,
                "status": "right",
                "detected_push_id": 222,
                "detected_push_revision": "cccc2222dddd",
            }
        ]
    )
    record.save()

    resp = client.get(reverse("performance-alerts-list"))
    assert resp.status_code == 200

    backfill = resp.json()["results"][0]["backfill_record"]
    assert backfill["detected_push_id"] == 222
    assert backfill["detected_push_revision"] == "cccc2222dddd"


def _backfill_logs(*statuses):
    """Log entries the way Sherlock writes them: one per iteration, starting with 'initial'."""
    return [{"iteration": i, "status": status} for i, status in enumerate(statuses)]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status, backfill_logs, expected_in_progress",
    [
        # Sherlock is working on it: waiting for a backfill or for the backfilled jobs
        pytest.param(
            BackfillRecord.BACKFILLED,
            _backfill_logs("initial", "backfill_requested"),
            True,
            id="backfill_running",
        ),
        pytest.param(
            BackfillRecord.READY_FOR_PROCESSING,
            _backfill_logs("initial", "right"),
            True,
            id="culprit_moved_retriggering",
        ),
        pytest.param(
            BackfillRecord.READY_FOR_PROCESSING,
            _backfill_logs("initial", "stabilized_with_gap"),
            True,
            id="stabilized_with_gap_retriggering",
        ),
        pytest.param(BackfillRecord.BACKFILLED, [], True, id="legacy_record_backfilling"),
        # not started yet
        pytest.param(
            BackfillRecord.PRELIMINARY, _backfill_logs("initial"), False, id="not_started"
        ),
        pytest.param(BackfillRecord.PRELIMINARY, [], False, id="legacy_record_not_started"),
        # finished with a terminal log status
        pytest.param(
            BackfillRecord.SUCCESSFUL,
            _backfill_logs("initial", "stabilized"),
            False,
            id="stabilized",
        ),
        pytest.param(
            BackfillRecord.SUCCESSFUL,
            _backfill_logs("initial", "stabilized_with_gap", "stabilized_gap_stuck"),
            False,
            id="gap_stuck",
        ),
        pytest.param(
            BackfillRecord.SUCCESSFUL,
            _backfill_logs("initial", "no_candidate_detected"),
            False,
            id="no_candidate_detected",
        ),
        # gave up without writing a terminal log status (timeout, failed trigger, max iterations)
        pytest.param(
            BackfillRecord.FAILED,
            _backfill_logs("initial", "backfill_requested"),
            False,
            id="failed_without_terminal_log",
        ),
        pytest.param(
            BackfillRecord.SUCCESSFUL,
            # 5 rounds; the last one is never verified once the iteration limit is hit
            _backfill_logs("initial", "right", "left", "right", "left", "backfill_requested"),
            False,
            id="max_iterations_reached",
        ),
        pytest.param(
            BackfillRecord.VERIFICATION_FAILED,
            _backfill_logs("initial", "backfill_requested"),
            False,
            id="verification_failed",
        ),
    ],
)
def test_alerts_list_exposes_in_progress_in_backfill_record(
    client,
    test_perf_alert,
    status,
    backfill_logs,
    expected_in_progress,
):
    report = BackfillReport.objects.create(summary=test_perf_alert.summary)
    record = BackfillRecord.objects.create(alert=test_perf_alert, report=report, status=status)
    record.backfill_logs = json.dumps(backfill_logs)
    record.save()

    resp = client.get(reverse("performance-alerts-list"))
    assert resp.status_code == 200

    backfill = resp.json()["results"][0]["backfill_record"]
    assert backfill["in_progress"] is expected_in_progress
