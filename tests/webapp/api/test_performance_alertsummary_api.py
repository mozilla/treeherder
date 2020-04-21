import datetime

import pytest
from django.urls import reverse

from treeherder.model.models import Push
from treeherder.perf.models import PerformanceAlertSummary


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
            revision='1234abcd{}'.format(i),
            author='foo@bar.com',
            time=datetime.datetime.now(),
        )

    return PerformanceAlertSummary.objects.create(
        repository=test_repository_onhold,
        framework=test_perf_framework,
        prev_push_id=1,
        push_id=2,
        manually_created=False,
        created=datetime.datetime.now(),
    )


@pytest.fixture
def test_perf_alert_onhold(test_perf_signature, test_perf_alert_summary_onhold):
    from treeherder.perf.models import PerformanceAlert

    return PerformanceAlert.objects.create(
        summary=test_perf_alert_summary_onhold,
        series_signature=test_perf_signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0,
    )


def test_alert_summaries_get(client, test_perf_alert_summary, test_perf_alert):
    # verify that we get the performance summary + alert on GET
    resp = client.get(reverse('performance-alert-summaries-list'))
    assert resp.status_code == 200

    # should just have the one alert summary (with one alert)
    assert resp.json()['next'] is None
    assert resp.json()['previous'] is None
    assert len(resp.json()['results']) == 1
    assert set(resp.json()['results'][0].keys()) == set(
        [
            'alerts',
            'bug_number',
            'bug_updated',
            'issue_tracker',
            'notes',
            'assignee_username',
            'assignee_email',
            'framework',
            'id',
            'created',
            'prev_push_id',
            'related_alerts',
            'repository',
            'push_id',
            'status',
            'revision',
            'push_timestamp',
            'prev_push_revision',
        ]
    )
    assert len(resp.json()['results'][0]['alerts']) == 1
    assert set(resp.json()['results'][0]['alerts'][0].keys()) == set(
        [
            'id',
            'status',
            'series_signature',
            'is_regression',
            'starred',
            'manually_created',
            'prev_value',
            'new_value',
            't_value',
            'amount_abs',
            'amount_pct',
            'summary_id',
            'related_summary_id',
            'classifier',
            'classifier_email',
            'backfill_record',
        ]
    )
    assert resp.json()['results'][0]['related_alerts'] == []


def test_alert_summaries_get_onhold(
    client,
    test_perf_alert_summary,
    test_perf_alert,
    test_perf_alert_summary_onhold,
    test_perf_alert_onhold,
    test_repository_onhold,
):
    # verify that we get the performance summary + alert on GET
    resp = client.get(reverse('performance-alert-summaries-list'))
    assert resp.status_code == 200

    # should just have the one alert summary (with one alert)
    assert resp.json()['next'] is None
    assert resp.json()['previous'] is None
    assert len(resp.json()['results']) == 1
    assert set(resp.json()['results'][0].keys()) == set(
        [
            'alerts',
            'bug_number',
            'bug_updated',
            'issue_tracker',
            'notes',
            'assignee_username',
            'assignee_email',
            'framework',
            'id',
            'created',
            'prev_push_id',
            'related_alerts',
            'repository',
            'push_id',
            'status',
            'revision',
            'push_timestamp',
            'prev_push_revision',
        ]
    )
    assert len(resp.json()['results'][0]['alerts']) == 1
    assert set(resp.json()['results'][0]['alerts'][0].keys()) == set(
        [
            'id',
            'status',
            'series_signature',
            'is_regression',
            'starred',
            'manually_created',
            'prev_value',
            'new_value',
            't_value',
            'amount_abs',
            'amount_pct',
            'summary_id',
            'related_summary_id',
            'classifier',
            'classifier_email',
            'backfill_record',
        ]
    )
    assert resp.json()['results'][0]['related_alerts'] == []


def test_alert_summaries_put(
    client, test_repository, test_perf_signature, test_perf_alert_summary, test_user, test_sheriff
):
    # verify that we fail if not authenticated
    resp = client.put(reverse('performance-alert-summaries-list') + '1/', {'status': 1})
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.get(id=1).status == 0

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.put(reverse('performance-alert-summaries-list') + '1/', {'status': 1})
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.get(id=1).status == 0

    # verify that we succeed if authenticated + staff
    client.force_authenticate(user=test_sheriff)
    resp = client.put(reverse('performance-alert-summaries-list') + '1/', {'status': 1})
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.get(id=1).status == 1

    # verify we can set assignee
    client.force_authenticate(user=test_sheriff)
    resp = client.put(
        reverse('performance-alert-summaries-list') + '1/',
        {'assignee_username': test_user.username},
    )
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.get(id=1).assignee == test_user


def test_alert_summary_post(
    client,
    test_repository,
    test_issue_tracker,
    push_stored,
    test_perf_signature,
    test_user,
    test_sheriff,
):
    # this blob should be sufficient to create a new alert summary (assuming
    # the user of this API is authorized to do so!)
    post_blob = {
        'repository_id': test_repository.id,
        'framework_id': test_perf_signature.framework.id,
        'prev_push_id': 1,
        'push_id': 2,
    }

    # verify that we fail if not authenticated
    resp = client.post(reverse('performance-alert-summaries-list'), post_blob)
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.count() == 0

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.post(reverse('performance-alert-summaries-list'), post_blob)
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.count() == 0

    # verify that we succeed if authenticated + staff
    client.force_authenticate(user=test_sheriff)
    resp = client.post(reverse('performance-alert-summaries-list'), post_blob)
    assert resp.status_code == 200

    assert PerformanceAlertSummary.objects.count() == 1
    alert_summary = PerformanceAlertSummary.objects.first()
    assert alert_summary.repository == test_repository
    assert alert_summary.framework == test_perf_signature.framework
    assert alert_summary.prev_push_id == post_blob['prev_push_id']
    assert alert_summary.push_id == post_blob['push_id']
    assert resp.data['alert_summary_id'] == alert_summary.id

    # verify that we don't create a new performance alert summary if one
    # already exists (but also don't throw an error)
    resp = client.post(reverse('performance-alert-summaries-list'), post_blob)
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.count() == 1


@pytest.mark.parametrize(
    'modification', [{'notes': 'human created notes'}, {'bug_number': 123456, 'issue_tracker': 1}]
)
def test_alert_summary_timestamps_via_endpoints(
    authorized_sheriff_client, test_perf_alert_summary, modification
):
    assert test_perf_alert_summary.first_triaged is None

    # when editing notes & linking bugs
    resp = authorized_sheriff_client.put(
        reverse('performance-alert-summaries-list') + '1/', modification
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
        reverse('performance-alert-summaries-list') + '1/', {'bug_number': 123456}
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
    assert test_perf_alert_summary_with_bug.bug_updated < datetime.datetime.now()

    bug_linking_time = test_perf_alert_summary_with_bug.bug_updated

    # update the existing bug number
    resp = authorized_sheriff_client.put(
        reverse('performance-alert-summaries-list') + '1/', {'bug_number': 987654}
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
        reverse('performance-alert-summaries-list') + '1/', {'notes': 'human created notes'}
    )
    assert resp.status_code == 200
    test_perf_alert_summary.refresh_from_db()

    # bug fields shouldn't have updated
    assert test_perf_alert_summary.bug_number is None
    assert test_perf_alert_summary.bug_updated is None
