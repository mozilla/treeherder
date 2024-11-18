import uuid
from datetime import datetime, timedelta

import pytest
from django.urls import reverse

from tests.conftest import create_perf_alert
from treeherder.model.models import Push
from treeherder.perf.models import PerformanceAlertSummary, PerformanceAlert


@pytest.fixture
def test_repository_onhold(transactional_db):
    from treeherder.model.models import Repository

    r = Repository.objects.create(
        dvcs_type="hg",
        name="treeherder_test_onhold",
        url="https://hg.mozilla.org/mozilla-central",
        active_status="onhold",
        codebase="gecko",
        repository_group_id=1,
        description="",
        performance_alerts_enabled=True,
    )
    return r


@pytest.fixture
def test_perf_alert_summary_onhold(test_repository_onhold, test_perf_framework):
    for i in range(2):
        Push.objects.create(
            repository=test_repository_onhold,
            revision=f"1234abcd{i}",
            author="foo@bar.com",
            time=datetime.now(),
        )

    return PerformanceAlertSummary.objects.create(
        repository=test_repository_onhold,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.now(),
    )


@pytest.fixture
def test_perf_alert_onhold(test_perf_signature, test_perf_alert_summary_onhold) -> PerformanceAlert:
    return create_perf_alert(
        summary=test_perf_alert_summary_onhold, series_signature=test_perf_signature
    )


def test_alert_summaries_get(
    client,
    test_perf_alert_summary,
    test_perf_alert_with_tcmetadata,
    test_perf_datum,
    test_perf_datum_2,
    test_taskcluster_metadata,
    test_taskcluster_metadata_2,
):
    # verify that we get the performance summary + alert on GET
    resp = client.get(reverse("performance-alert-summaries-list"))
    assert resp.status_code == 200

    # should just have the one alert summary (with one alert)
    assert resp.json()["next"] is None
    assert resp.json()["previous"] is None
    assert len(resp.json()["results"]) == 1
    assert set(resp.json()["results"][0].keys()) == {
        "alerts",
        "bug_number",
        "bug_updated",
        "bug_due_date",
        "issue_tracker",
        "notes",
        "assignee_username",
        "assignee_email",
        "framework",
        "id",
        "created",
        "first_triaged",
        "triage_due_date",
        "prev_push_id",
        "related_alerts",
        "repository",
        "push_id",
        "status",
        "revision",
        "push_timestamp",
        "prev_push_revision",
        "performance_tags",
    }
    assert len(resp.json()["results"][0]["alerts"]) == 1
    assert set(resp.json()["results"][0]["alerts"][0].keys()) == {
        "id",
        "status",
        "series_signature",
        "taskcluster_metadata",
        "prev_taskcluster_metadata",
        "profile_url",
        "prev_profile_url",
        "is_regression",
        "starred",
        "manually_created",
        "prev_value",
        "new_value",
        "t_value",
        "amount_abs",
        "amount_pct",
        "summary_id",
        "related_summary_id",
        "classifier",
        "classifier_email",
        "backfill_record",
        "noise_profile",
    }
    assert resp.json()["results"][0]["related_alerts"] == []
    assert set(resp.json()["results"][0]["alerts"][0]["taskcluster_metadata"].keys()) == {
        "task_id",
        "retry_id",
    }
    assert set(resp.json()["results"][0]["alerts"][0]["prev_taskcluster_metadata"].keys()) == {
        "task_id",
        "retry_id",
    }


def test_alert_summaries_get_onhold(
    client,
    test_perf_alert_summary,
    test_perf_alert_with_tcmetadata,
    test_perf_datum,
    test_perf_datum_2,
    test_taskcluster_metadata,
    test_taskcluster_metadata_2,
    test_perf_alert_summary_onhold,
    test_perf_alert_onhold,
    test_repository_onhold,
):
    # verify that we get the performance summary + alert on GET
    resp = client.get(reverse("performance-alert-summaries-list"))
    assert resp.status_code == 200

    # should just have the one alert summary (with one alert)
    assert resp.json()["next"] is None
    assert resp.json()["previous"] is None
    assert len(resp.json()["results"]) == 1
    assert set(resp.json()["results"][0].keys()) == {
        "alerts",
        "bug_number",
        "bug_updated",
        "bug_due_date",
        "issue_tracker",
        "notes",
        "assignee_username",
        "assignee_email",
        "framework",
        "id",
        "created",
        "first_triaged",
        "triage_due_date",
        "prev_push_id",
        "related_alerts",
        "repository",
        "push_id",
        "status",
        "revision",
        "push_timestamp",
        "prev_push_revision",
        "performance_tags",
    }
    assert len(resp.json()["results"][0]["alerts"]) == 1
    assert set(resp.json()["results"][0]["alerts"][0].keys()) == {
        "id",
        "status",
        "series_signature",
        "taskcluster_metadata",
        "prev_taskcluster_metadata",
        "profile_url",
        "prev_profile_url",
        "is_regression",
        "starred",
        "manually_created",
        "prev_value",
        "new_value",
        "t_value",
        "amount_abs",
        "amount_pct",
        "summary_id",
        "related_summary_id",
        "classifier",
        "classifier_email",
        "backfill_record",
        "noise_profile",
    }
    assert resp.json()["results"][0]["related_alerts"] == []
    assert set(resp.json()["results"][0]["alerts"][0]["taskcluster_metadata"].keys()) == {
        "task_id",
        "retry_id",
    }
    assert set(resp.json()["results"][0]["alerts"][0]["prev_taskcluster_metadata"].keys()) == {
        "task_id",
        "retry_id",
    }


def test_alert_summaries_put(
    client, test_repository, test_perf_signature, test_perf_alert_summary, test_user, test_sheriff
):
    # verify that we fail if not authenticated
    resp = client.put(reverse("performance-alert-summaries-list") + "1/", {"status": 1})
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.get(id=1).status == 0

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.put(reverse("performance-alert-summaries-list") + "1/", {"status": 1})
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.get(id=1).status == 0

    # verify that we succeed if authenticated + staff
    client.force_authenticate(user=test_sheriff)
    resp = client.put(reverse("performance-alert-summaries-list") + "1/", {"status": 1})
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.get(id=1).status == 1

    # verify we can set assignee
    client.force_authenticate(user=test_sheriff)
    resp = client.put(
        reverse("performance-alert-summaries-list") + "1/",
        {"assignee_username": test_user.username},
    )
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.get(id=1).assignee == test_user


def test_performance_alert_summary_change_revision(
    client, test_repository, test_perf_signature, test_perf_alert_summary, test_user, test_sheriff):

    # verify we can set revision
    client.force_authenticate(user=test_sheriff)
    resp = client.put(
        reverse("performance-alert-summaries-list") + "1/",
        {"revision": "b11529c9865a4dee3a93d63d119ebb89fcbbdf69"},
    )
    assert resp.status_code == 200

    obj = PerformanceAlertSummary.objects.get(id=1)
    assert str(getattr(obj, "push")).split()[-1] == "b11529c9865a4dee3a93d63d119ebb89fcbbdf69"

    # verify we can set inexistent revision
    client.force_authenticate(user=test_sheriff)
    resp = client.put(
        reverse("performance-alert-summaries-list") + "1/",
        {"revision": "no-push-revision"},
    )
    assert resp.status_code == 400

    # revert revision
    original_revision = str((getattr(obj, "original_push"))).split()[-1]
    client.force_authenticate(user=test_sheriff)
    resp = client.put(
        reverse("performance-alert-summaries-list") + "1/",
        {"revision": original_revision},
    )
    assert resp.status_code == 200
    assert str(getattr(obj, "push")).split()[-1] == original_revision

def test_auth_for_alert_summary_post(
    client,
    test_repository,
    test_issue_tracker,
    push_stored,
    test_perf_signature,
    test_user,
    test_sheriff,
):
    post_blob = {
        "repository_id": test_repository.id,
        "framework_id": test_perf_signature.framework.id,
        "prev_push_id": 1,
        "push_id": 2,
    }

    # verify that we fail if not authenticated
    resp = client.post(reverse("performance-alert-summaries-list"), post_blob)
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.count() == 0

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.post(reverse("performance-alert-summaries-list"), post_blob)
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.count() == 0


def test_alert_summary_post(
    authorized_sheriff_client,
    test_repository,
    test_issue_tracker,
    push_stored,
    test_perf_signature,
    test_user,
    test_sheriff,
):
    post_blob = {
        "repository_id": test_repository.id,
        "framework_id": test_perf_signature.framework.id,
        "prev_push_id": 1,
        "push_id": 2,
    }

    # verify that we succeed if authenticated + staff
    resp = authorized_sheriff_client.post(reverse("performance-alert-summaries-list"), post_blob)
    assert resp.status_code == 200

    assert PerformanceAlertSummary.objects.count() == 1
    alert_summary = PerformanceAlertSummary.objects.first()
    assert alert_summary.repository == test_repository
    assert alert_summary.framework == test_perf_signature.framework
    assert alert_summary.prev_push_id == post_blob["prev_push_id"]
    assert alert_summary.push_id == post_blob["push_id"]
    assert resp.data["alert_summary_id"] == alert_summary.id

    # verify that we don't create a new performance alert summary if one
    # already exists (but also don't throw an error)
    resp = authorized_sheriff_client.post(reverse("performance-alert-summaries-list"), post_blob)
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.count() == 1


def test_push_range_validation_for_alert_summary_post(
    authorized_sheriff_client,
    test_repository,
    test_issue_tracker,
    push_stored,
    test_perf_signature,
    test_user,
    test_sheriff,
):
    identical_push = 1
    post_blob = {
        "repository_id": test_repository.id,
        "framework_id": test_perf_signature.framework.id,
        "prev_push_id": identical_push,
        "push_id": identical_push,
    }

    # verify that we succeed if authenticated + staff
    resp = authorized_sheriff_client.post(reverse("performance-alert-summaries-list"), post_blob)
    assert resp.status_code == 400

    assert PerformanceAlertSummary.objects.count() == 0


@pytest.mark.parametrize(
    "modification", [{"notes": "human created notes"}, {"bug_number": 123456, "issue_tracker": 1}]
)
def test_alert_summary_timestamps_via_endpoints(
    authorized_sheriff_client, test_perf_alert_summary, modification
):
    assert test_perf_alert_summary.first_triaged is None

    # when editing notes & linking bugs
    resp = authorized_sheriff_client.put(
        reverse("performance-alert-summaries-list") + "1/", modification
    )
    assert resp.status_code == 200
    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.first_triaged is not None
    assert test_perf_alert_summary.created < test_perf_alert_summary.first_triaged
    assert test_perf_alert_summary.created < test_perf_alert_summary.last_updated


def test_bug_number_and_timestamp_on_setting_value(
    authorized_sheriff_client, test_perf_alert_summary
):
    assert test_perf_alert_summary.first_triaged is None
    assert test_perf_alert_summary.bug_number is None
    assert test_perf_alert_summary.bug_updated is None

    # link a bug
    resp = authorized_sheriff_client.put(
        reverse("performance-alert-summaries-list") + "1/", {"bug_number": 123456}
    )
    assert resp.status_code == 200
    test_perf_alert_summary.refresh_from_db()

    # hopefully they updated
    assert test_perf_alert_summary.bug_number == 123456
    assert test_perf_alert_summary.bug_updated is not None


def test_bug_number_and_timestamp_on_overriding(
    authorized_sheriff_client, test_perf_alert_summary_with_bug
):
    assert test_perf_alert_summary_with_bug.bug_number == 123456
    assert test_perf_alert_summary_with_bug.bug_updated < datetime.now()

    bug_linking_time = test_perf_alert_summary_with_bug.bug_updated

    # update the existing bug number
    resp = authorized_sheriff_client.put(
        reverse("performance-alert-summaries-list") + "1/", {"bug_number": 987654}
    )

    assert resp.status_code == 200
    test_perf_alert_summary_with_bug.refresh_from_db()

    # hopefully they updated
    assert test_perf_alert_summary_with_bug.bug_number == 987654
    assert test_perf_alert_summary_with_bug.bug_updated > bug_linking_time


def test_bug_number_and_timestamp_dont_update_from_other_modifications(
    authorized_sheriff_client, test_perf_alert_summary
):
    assert test_perf_alert_summary.bug_number is None
    assert test_perf_alert_summary.bug_updated is None

    # link a bug
    resp = authorized_sheriff_client.put(
        reverse("performance-alert-summaries-list") + "1/", {"notes": "human created notes"}
    )
    assert resp.status_code == 200
    test_perf_alert_summary.refresh_from_db()

    # bug fields shouldn't have updated
    assert test_perf_alert_summary.bug_number is None
    assert test_perf_alert_summary.bug_updated is None


def test_add_multiple_tags_to_alert_summary(
    authorized_sheriff_client, test_perf_alert_summary, test_perf_tag, test_perf_tag_2
):
    assert test_perf_alert_summary.performance_tags.count() == 1

    resp = authorized_sheriff_client.put(
        reverse("performance-alert-summaries-list") + "1/",
        {"performance_tags": [test_perf_tag.name, test_perf_tag_2.name]},
    )
    assert resp.status_code == 200
    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.performance_tags.count() == 2


def test_remove_a_tag_from_a_summary(authorized_sheriff_client, test_perf_alert_summary):
    assert test_perf_alert_summary.performance_tags.count() == 1

    resp = authorized_sheriff_client.put(
        reverse("performance-alert-summaries-list") + "1/", {"performance_tags": []}
    )
    assert resp.status_code == 200
    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.performance_tags.count() == 0


def test_cannot_add_unregistered_tag_to_a_summary(
    authorized_sheriff_client, test_perf_alert_summary
):
    assert test_perf_alert_summary.performance_tags.count() == 1

    resp = authorized_sheriff_client.put(
        reverse("performance-alert-summaries-list") + "1/",
        {"performance_tags": ["unregistered-tag"]},
    )
    assert resp.status_code == 400
    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.performance_tags.count() == 1


def test_timerange_with_summary_outside_range(
    client, create_push, test_repository, test_perf_alert_summary, test_perf_alert_summary_2
):
    # 30 days timerange
    timerange_to_test = 30 * 24 * 60 * 60
    past_date = datetime.now() - timedelta(weeks=9)

    test_perf_alert_summary.push = create_push(
        test_repository, revision=uuid.uuid4(), time=past_date
    )
    test_perf_alert_summary.save()
    test_perf_alert_summary_2.push.time = datetime.now()
    test_perf_alert_summary_2.push.save()

    resp = client.get(
        reverse("performance-alert-summaries-list"),
        data={
            "framework": 1,
            "timerange": timerange_to_test,
        },
    )

    assert resp.status_code == 200

    retrieved_summaries = resp.json()["results"]
    summary_ids = [summary["id"] for summary in retrieved_summaries]

    assert test_perf_alert_summary_2.id in summary_ids
    assert len(summary_ids) == 1


def test_timerange_with_all_summaries_in_range(
    client, create_push, test_repository, test_perf_alert_summary, test_perf_alert_summary_2
):
    # 7 days timerange
    timerange_to_test = 7 * 24 * 60 * 60
    past_date = datetime.now() - timedelta(days=2)

    test_perf_alert_summary.push = create_push(
        test_repository, revision=uuid.uuid4(), time=past_date
    )
    test_perf_alert_summary.save()
    test_perf_alert_summary_2.push.time = datetime.now()
    test_perf_alert_summary_2.push.save()

    resp = client.get(
        reverse("performance-alert-summaries-list"),
        data={
            "framework": 1,
            "timerange": timerange_to_test,
        },
    )
    assert resp.status_code == 200

    retrieved_summaries = resp.json()["results"]
    summary_ids = [summary["id"] for summary in retrieved_summaries]

    assert test_perf_alert_summary.id in summary_ids
    assert test_perf_alert_summary_2.id in summary_ids
    assert len(summary_ids) == 2


def test_pagesize_is_limited_from_params(
    client, test_perf_alert_summary, test_perf_alert_summary_2
):
    resp = client.get(
        reverse("performance-alert-summaries-list"),
        data={
            "framework": 1,
            "limit": 1,
        },
    )
    assert resp.status_code == 200

    retrieved_summaries = resp.json()["results"]
    summary_ids = [summary["id"] for summary in retrieved_summaries]

    assert test_perf_alert_summary_2.id in summary_ids
    assert len(summary_ids) == 1


def test_pagesize_with_limit_higher_than_total_summaries(
    client, test_perf_alert_summary, test_perf_alert_summary_2
):
    resp = client.get(
        reverse("performance-alert-summaries-list"),
        data={
            "framework": 1,
            "limit": 5,
        },
    )
    assert resp.status_code == 200
    resp_json = resp.json()
    assert resp_json["next"] is None
    assert resp_json["previous"] is None
    retrieved_summaries = resp_json["results"]
    summary_ids = [summary["id"] for summary in retrieved_summaries]

    assert test_perf_alert_summary.id in summary_ids
    assert test_perf_alert_summary_2.id in summary_ids
    assert len(summary_ids) == 2


@pytest.fixture
def related_alert(test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature_2):
    return create_perf_alert(
        summary=test_perf_alert_summary_2,
        series_signature=test_perf_signature_2,
        related_summary=test_perf_alert_summary,
        status=PerformanceAlert.REASSIGNED,
    )


@pytest.mark.parametrize(
    "text_to_filter",
    ["mysuite2", "mysuite2 mytest2", "mytest2 win7", "mysuite2 mytest2 win7 e10s opt"],
)
def test_filter_text_accounts_for_related_alerts_also(
    text_to_filter, client, test_perf_alert_summary, test_perf_alert, related_alert
):
    summary_id = test_perf_alert_summary.id

    resp = client.get(
        reverse("performance-alert-summaries-list"),
        data={
            "framework": 1,
            "page": 1,
            "filter_text": text_to_filter,
        },  # excluded 'status' field to emulate 'all statuses'
    )
    assert resp.status_code == 200

    retrieved_summaries = resp.json()["results"]
    summary_ids = [summary["id"] for summary in retrieved_summaries]

    assert summary_id in summary_ids
    # also ensure original & related summary are both fetched
    assert len(summary_ids) == 2
