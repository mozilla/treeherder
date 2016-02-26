import datetime

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary)


def test_alerts(webapp, test_repository, test_perf_signature):
    s = PerformanceAlertSummary.objects.create(
        id=1,
        repository=test_repository,
        prev_result_set_id=0,
        result_set_id=1,
        last_updated=datetime.datetime.now())
    PerformanceAlert.objects.create(
        id=1,
        summary=s,
        series_signature=test_perf_signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)

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
        'new_value',
        'prev_value',
        'related_summary_id',
        'series_signature',
        'summary_id',
        'status',
        't_value'
    ])
    assert resp.json['results'][0]['related_summary_id'] is None

    # create a new summary and reassign the alert to it
    PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_repository,
        prev_result_set_id=1,
        result_set_id=2,
        last_updated=datetime.datetime.now())

    # verify that we fail if not authenticated
    webapp.put_json(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, status=403)
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we fail if authenticated, but not staff
    client = APIClient()
    user = User.objects.create(username="testuser1",
                               email='foo1@bar.com',
                               is_staff=False)
    client.force_authenticate(user=user)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, format='json')
    assert resp.status_code == 403
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we succeed if authenticated + staff
    client = APIClient()
    user = User.objects.create(username="testuser2",
                               email='foo2@bar.com',
                               is_staff=True)
    client.force_authenticate(user=user)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    }, format='json')
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id == 2

    # verify that we can unset it too
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': None,
        'status': PerformanceAlert.UNTRIAGED
    }, format='json')
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None
