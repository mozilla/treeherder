import copy
import datetime

import pytest
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.model.models import Push
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceFramework)


def test_alerts_get(webapp, test_repository, test_perf_alert):
    resp = webapp.get(reverse('performance-alerts-list'))
    assert resp.status_int == 200

    # should just have the one alert
    assert resp.json['next'] is None
    assert resp.json['previous'] is None
    assert len(resp.json['results']) == 1
    assert set(resp.json['results'][0].keys()) == set([
        'amount_pct',
        'amount_abs',
        'id',
        'is_regression',
        'manually_created',
        'new_value',
        'prev_value',
        'related_summary_id',
        'series_signature',
        'summary_id',
        'status',
        't_value',
        'classifier'
    ])
    assert resp.json['results'][0]['related_summary_id'] is None


@pytest.fixture
def test_perf_alert_summary_2(test_perf_alert_summary):
    return PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_perf_alert_summary.repository,
        prev_push_id=2,
        push_id=3,
        last_updated=datetime.datetime.now(),
        framework=test_perf_alert_summary.framework,
        manually_created=False)


def test_alerts_put(webapp, result_set_stored, test_repository,
                    test_perf_alert, test_perf_alert_summary_2, test_user,
                    test_sheriff):
    resp = webapp.get(reverse('performance-alerts-list'))
    assert resp.status_int == 200
    assert resp.json['results'][0]['related_summary_id'] is None

    # verify that we fail if not authenticated
    webapp.put_json(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, status=403)
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we fail if authenticated, but not staff
    client = APIClient()
    client.force_authenticate(user=test_user)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, format='json')
    assert resp.status_code == 403
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we succeed if authenticated + staff
    client = APIClient()
    client.force_authenticate(user=test_sheriff)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, format='json')
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id == 2
    assert PerformanceAlert.objects.get(id=1).classifier == test_sheriff

    # verify that we can unset it too
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': None,
        'status': PerformanceAlert.UNTRIAGED
    }, format='json')
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None


def test_reassign_different_repository(result_set_stored,
                                       test_repository, test_repository_2,
                                       test_perf_alert,
                                       test_perf_alert_summary_2,
                                       test_sheriff):
    # verify that we can't reassign to another performance alert summary
    # with a different repository unless the new status is downstream
    test_perf_alert_summary_2.repository = test_repository_2
    test_perf_alert_summary_2.save()

    client = APIClient()
    client.force_authenticate(user=test_sheriff)

    # reassign to summary with different repository, should fail
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': test_perf_alert_summary_2.id,
        'status': PerformanceAlert.REASSIGNED
    }, format='json')
    assert resp.status_code == 400
    test_perf_alert.refresh_from_db()
    assert test_perf_alert.related_summary_id is None
    assert test_perf_alert.status == PerformanceAlert.UNTRIAGED

    # mark downstream of summary with different repository,
    # should succeed
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': test_perf_alert_summary_2.id,
        'status': PerformanceAlert.DOWNSTREAM
    }, format='json')
    assert resp.status_code == 200
    test_perf_alert.refresh_from_db()
    assert test_perf_alert.related_summary_id == test_perf_alert_summary_2.id
    assert test_perf_alert.classifier == test_sheriff


def test_reassign_different_framework(result_set_stored,
                                      test_repository, test_repository_2,
                                      test_perf_alert,
                                      test_perf_alert_summary_2,
                                      test_sheriff):
    # try to assign to an alert with a different framework,
    # should fail
    framework_2 = PerformanceFramework.objects.create(
        name='test_talos_2', enabled=True)
    test_perf_alert_summary_2.framework = framework_2
    test_perf_alert_summary_2.save()

    client = APIClient()
    client.force_authenticate(user=test_sheriff)

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': test_perf_alert_summary_2.id,
        'status': PerformanceAlert.REASSIGNED
    }, format='json')
    assert resp.status_code == 400
    test_perf_alert.refresh_from_db()
    assert test_perf_alert.related_summary_id is None
    assert test_perf_alert.status == PerformanceAlert.UNTRIAGED


@pytest.fixture
def alert_create_post_blob(test_perf_alert_summary, test_perf_signature):
    # this blob should be sufficient to create a new alert (assuming
    # the user of this API is authorized to do so!)
    return {
        'summary_id': test_perf_alert_summary.id,
        'signature_id': test_perf_signature.id
    }


def test_alerts_post(webapp, test_repository, test_perf_signature,
                     test_perf_alert_summary, alert_create_post_blob,
                     test_user, test_sheriff):

    # generate enough data for a proper alert to be generated (with enough
    # extra data on both sides to make sure we're using the proper values
    # to generate the actual alert)
    for (push_id, job_id, value) in zip([1]*30 + [2]*30,
                                        range(1, 61),
                                        [1]*30 + [2]*30):
        # push_id == result_set_id == timestamp for purposes of this test
        push = Push.objects.get(id=push_id)
        PerformanceDatum.objects.create(repository=test_repository,
                                        result_set_id=push_id,
                                        push_id=push_id,
                                        signature=test_perf_signature,
                                        value=value,
                                        push_timestamp=push.time)

    # verify that we fail if not authenticated
    webapp.post_json(reverse('performance-alerts-list'),
                     alert_create_post_blob, status=403)

    # verify that we fail if authenticated, but not staff
    client = APIClient()
    client.force_authenticate(user=test_user)
    resp = client.post(reverse('performance-alerts-list'),
                       alert_create_post_blob)
    assert resp.status_code == 403
    assert PerformanceAlert.objects.count() == 0

    # verify that we succeed if staff + authenticated
    client = APIClient()
    client.force_authenticate(user=test_sheriff)
    resp = client.post(reverse('performance-alerts-list'),
                       alert_create_post_blob)
    assert resp.status_code == 200
    assert PerformanceAlert.objects.count() == 1

    alert = PerformanceAlert.objects.all()[0]
    assert alert.status == PerformanceAlert.UNTRIAGED
    assert alert.manually_created
    assert alert.amount_pct == 100
    assert alert.amount_abs == 1
    assert alert.prev_value == 1
    assert alert.new_value == 2
    assert alert.is_regression
    assert alert.summary.id == 1


def test_alerts_post_insufficient_data(test_repository,
                                       test_perf_alert_summary,
                                       test_perf_signature, test_sheriff,
                                       alert_create_post_blob):
    # we should not succeed if insufficient data is passed through
    client = APIClient()
    client.force_authenticate(user=test_sheriff)

    for removed_key in ['summary_id', 'signature_id']:
        new_post_blob = copy.copy(alert_create_post_blob)
        del new_post_blob[removed_key]

        resp = client.post(reverse('performance-alerts-list'),
                           new_post_blob)
        assert resp.status_code == 400
        assert PerformanceAlert.objects.count() == 0
