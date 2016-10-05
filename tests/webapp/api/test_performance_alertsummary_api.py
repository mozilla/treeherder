import pytest
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.perf.models import PerformanceAlertSummary

pytestmark = pytest.mark.skip(reason='Maintenance mode')


def test_alert_summaries_get(webapp, test_perf_alert_summary,
                             test_perf_alert):
    # verify that we get the performance summary + alert on GET
    resp = webapp.get(reverse('performance-alert-summaries-list'))
    assert resp.status_int == 200

    # should just have the one alert summary (with one alert)
    assert resp.json['next'] is None
    assert resp.json['previous'] is None
    assert len(resp.json['results']) == 1
    assert set(resp.json['results'][0].keys()) == set([
        'alerts',
        'bug_number',
        'framework',
        'id',
        'last_updated',
        'prev_result_set_id',
        'related_alerts',
        'repository',
        'result_set_id',
        'status',
    ])
    assert len(resp.json['results'][0]['alerts']) == 1
    assert set(resp.json['results'][0]['alerts'][0].keys()) == set([
        'id',
        'status',
        'series_signature',
        'is_regression',
        'manually_created',
        'prev_value',
        'new_value',
        't_value',
        'amount_abs',
        'amount_pct',
        'summary_id',
        'related_summary_id',
        'classifier'
    ])
    assert len(resp.json['results'][0]['related_alerts']) == 0


def test_alert_summaries_put(webapp, test_repository, test_perf_signature,
                             test_perf_alert_summary, test_user, test_sheriff):
    # verify that we fail if not authenticated
    webapp.put_json(reverse('performance-alert-summaries-list') + '1/', {
        'status': 1
    }, status=403)
    assert PerformanceAlertSummary.objects.get(id=1).status == 0

    # verify that we fail if authenticated, but not staff
    client = APIClient()
    client.force_authenticate(user=test_user)
    resp = client.put(reverse('performance-alert-summaries-list') + '1/', {
        'status': 1
    }, format='json')
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.get(id=1).status == 0

    # verify that we succeed if authenticated + staff
    client = APIClient()
    client.force_authenticate(user=test_sheriff)
    resp = client.put(reverse('performance-alert-summaries-list') + '1/', {
        'status': 1
    }, format='json')
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.get(id=1).status == 1


def test_alert_summary_post(webapp, test_repository, test_perf_signature):
    # this blob should be sufficient to create a new alert summary (assuming
    # the user of this API is authorized to do so!)
    post_blob = {
        'repository_id': test_repository.id,
        'framework_id': test_perf_signature.framework.id,
        'prev_result_set_id': 1,
        'result_set_id': 2
    }

    # verify that we fail if not authenticated
    webapp.post_json(reverse('performance-alert-summaries-list'), post_blob,
                     status=403)
    assert PerformanceAlertSummary.objects.count() == 0

    # verify that we fail if authenticated, but not staff
    client = APIClient()
    user = User.objects.create(username="testuser1",
                               email='foo1@bar.com',
                               is_staff=False)
    client.force_authenticate(user=user)
    resp = client.post(reverse('performance-alert-summaries-list'), post_blob)
    assert resp.status_code == 403
    assert PerformanceAlertSummary.objects.count() == 0

    # verify that we succeed if authenticated + staff
    client = APIClient()
    user = User.objects.create(username="testuser2",
                               email='foo2@bar.com',
                               is_staff=True)
    client.force_authenticate(user=user)
    resp = client.post(reverse('performance-alert-summaries-list'), post_blob)
    assert resp.status_code == 200

    assert PerformanceAlertSummary.objects.count() == 1
    alert_summary = PerformanceAlertSummary.objects.all()[0]
    assert alert_summary.repository == test_repository
    assert alert_summary.framework == test_perf_signature.framework
    assert alert_summary.prev_result_set_id == post_blob['prev_result_set_id']
    assert alert_summary.result_set_id == post_blob['result_set_id']
    assert resp.data['alert_summary_id'] == alert_summary.id

    # verify that we don't create a new performance alert summary if one
    # already exists (but also don't throw an error)
    resp = client.post(reverse('performance-alert-summaries-list'), post_blob)
    assert resp.status_code == 200
    assert PerformanceAlertSummary.objects.count() == 1
