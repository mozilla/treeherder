import datetime

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary)


def test_alert_summaries(webapp, test_repository, test_perf_signature,
                         test_user, test_sheriff):
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

    # verify that we get the performance summary + alert on GET
    resp = webapp.get(reverse('performance-alert-summaries-list'))
    assert resp.status_int == 200

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
