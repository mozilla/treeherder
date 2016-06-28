import copy
import datetime

import pytest
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum)


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
        't_value'
    ])
    assert resp.json['results'][0]['related_summary_id'] is None


def test_alerts_put(webapp, test_repository, test_perf_alert, test_user,
                    test_sheriff):
    # create a new summary and try to reassign the alert to it with varying
    # levels of permission, then verify the return value changes accordingly
    PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_repository,
        prev_result_set_id=1,
        result_set_id=2,
        last_updated=datetime.datetime.now(),
        manually_created=False)

    resp = webapp.get(reverse('performance-alerts-list'))
    assert resp.status_int == 200
    assert resp.json['results'][0]['related_summary_id'] is None

    # verify that we fail if not authenticated
    webapp.put_json(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, status=503)
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we fail if authenticated, but not staff
    client = APIClient()
    client.force_authenticate(user=test_user)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, format='json')
    assert resp.status_code == 503
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we succeed if authenticated + staff
    client = APIClient()
    client.force_authenticate(user=test_sheriff)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, format='json')
    assert resp.status_code == 503
    assert PerformanceAlert.objects.get(id=1).related_summary_id == None

    # verify that we can unset it too
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': None,
        'status': PerformanceAlert.UNTRIAGED
    }, format='json')
    assert resp.status_code == 503
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None


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

    # generate enough data for a proper alert to be generated
    for (result_set_id, value) in zip([0]*15 + [1]*15, [1]*15 + [2]*15):
        PerformanceDatum.objects.create(repository=test_repository,
                                        job_id=0,
                                        result_set_id=result_set_id,
                                        signature=test_perf_signature,
                                        value=value,
                                        push_timestamp=datetime.datetime.now())

    # verify that we fail if not authenticated
    webapp.post_json(reverse('performance-alerts-list'),
                     alert_create_post_blob, status=503)

    # verify that we fail if authenticated, but not staff
    client = APIClient()
    client.force_authenticate(user=test_user)
    resp = client.post(reverse('performance-alerts-list'),
                       alert_create_post_blob)
    assert resp.status_code == 503
    assert PerformanceAlert.objects.count() == 0

    # verify that we succeed if staff + authenticated
    client = APIClient()
    client.force_authenticate(user=test_sheriff)
    resp = client.post(reverse('performance-alerts-list'),
                       alert_create_post_blob)
    assert resp.status_code == 503
    assert PerformanceAlert.objects.count() == 0

    # alert = PerformanceAlert.objects.all()[0]
    # assert alert.status == PerformanceAlert.UNTRIAGED
    # assert alert.manually_created
    # assert alert.amount_pct == 100
    # assert alert.amount_abs == 1
    # assert alert.prev_value == 1
    # assert alert.new_value == 2
    # assert alert.is_regression
    # assert alert.summary.id == 1


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
        assert resp.status_code == 503
        assert PerformanceAlert.objects.count() == 0
