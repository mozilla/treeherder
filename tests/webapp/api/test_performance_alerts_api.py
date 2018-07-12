import copy

import pytest
from django.core.urlresolvers import reverse

from treeherder.model.models import Push
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceFramework)


def test_alerts_get(client, test_repository, test_perf_alert):
    resp = client.get(reverse('performance-alerts-list'))
    assert resp.status_code == 200

    # should just have the one alert
    assert resp.json()['next'] is None
    assert resp.json()['previous'] is None
    assert len(resp.json()['results']) == 1
    assert set(resp.json()['results'][0].keys()) == set([
        'amount_pct',
        'amount_abs',
        'id',
        'is_regression',
        'starred',
        'manually_created',
        'new_value',
        'prev_value',
        'related_summary_id',
        'series_signature',
        'summary_id',
        'status',
        't_value',
        'classifier',
        'classifier_email'
    ])
    assert resp.json()['results'][0]['related_summary_id'] is None


def test_alerts_put(client, push_stored, test_repository,
                    test_perf_alert, test_perf_alert_summary_2, test_user,
                    test_sheriff):
    resp = client.get(reverse('performance-alerts-list'))
    assert resp.status_code == 200
    assert resp.json()['results'][0]['related_summary_id'] is None

    # verify that we fail if not authenticated
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    })
    assert resp.status_code == 403
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    })
    assert resp.status_code == 403
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None

    # verify that we succeed if authenticated + staff
    client.force_authenticate(user=test_sheriff)
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': 2,
        'status': PerformanceAlert.DOWNSTREAM
    })
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id == 2
    assert PerformanceAlert.objects.get(id=1).classifier == test_sheriff

    # verify that we can unset it too
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': None,
        'status': PerformanceAlert.UNTRIAGED
    })
    assert resp.status_code == 200
    assert PerformanceAlert.objects.get(id=1).related_summary_id is None


def test_reassign_different_repository(client,
                                       push_stored,
                                       test_repository, test_repository_2,
                                       test_perf_alert,
                                       test_perf_alert_summary_2,
                                       test_sheriff):
    # verify that we can't reassign to another performance alert summary
    # with a different repository unless the new status is downstream
    test_perf_alert_summary_2.repository = test_repository_2
    test_perf_alert_summary_2.save()

    client.force_authenticate(user=test_sheriff)

    # reassign to summary with different repository, should fail
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': test_perf_alert_summary_2.id,
        'status': PerformanceAlert.REASSIGNED
    })
    assert resp.status_code == 400
    test_perf_alert.refresh_from_db()
    assert test_perf_alert.related_summary_id is None
    assert test_perf_alert.status == PerformanceAlert.UNTRIAGED

    # mark downstream of summary with different repository,
    # should succeed
    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': test_perf_alert_summary_2.id,
        'status': PerformanceAlert.DOWNSTREAM
    })
    assert resp.status_code == 200
    test_perf_alert.refresh_from_db()
    assert test_perf_alert.related_summary_id == test_perf_alert_summary_2.id
    assert test_perf_alert.classifier == test_sheriff


def test_reassign_different_framework(client,
                                      push_stored,
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

    client.force_authenticate(user=test_sheriff)

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'related_summary_id': test_perf_alert_summary_2.id,
        'status': PerformanceAlert.REASSIGNED
    })
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


def test_alerts_post(client, test_repository, test_perf_signature,
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
    resp = client.post(reverse('performance-alerts-list'),
                       alert_create_post_blob)
    assert resp.status_code == 403

    # verify that we fail if authenticated, but not staff
    client.force_authenticate(user=test_user)
    resp = client.post(reverse('performance-alerts-list'),
                       alert_create_post_blob)
    assert resp.status_code == 403
    assert PerformanceAlert.objects.count() == 0

    # verify that we succeed if staff + authenticated
    client.force_authenticate(user=test_sheriff)
    resp = client.post(reverse('performance-alerts-list'),
                       alert_create_post_blob)
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


def test_alerts_post_insufficient_data(client,
                                       test_repository,
                                       test_perf_alert_summary,
                                       test_perf_signature, test_sheriff,
                                       alert_create_post_blob):
    client.force_authenticate(user=test_sheriff)
    # we should not succeed if insufficient data is passed through
    for removed_key in ['summary_id', 'signature_id']:
        new_post_blob = copy.copy(alert_create_post_blob)
        del new_post_blob[removed_key]

        resp = client.post(reverse('performance-alerts-list'),
                           new_post_blob)
        assert resp.status_code == 400
        assert PerformanceAlert.objects.count() == 0


def test_nudge_left_alert_to_changeset_without_alert_summary(client,
                                                             test_sheriff,
                                                             test_perf_alert,
                                                             test_perf_data):
    client.force_authenticate(user=test_sheriff)
    link_alert_summary_in_perf_data(test_perf_data, test_perf_alert,
                                    perf_datum_id=3)

    old_alert_summary_id = test_perf_alert.summary.id

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'push_id': 2,
        'prev_push_id': 1
    })

    assert resp.status_code == 200

    test_perf_alert.refresh_from_db()

    assert test_perf_alert.summary.id != old_alert_summary_id
    assert 'alert_summary_id' in resp.json()
    assert resp.json()['alert_summary_id'] == test_perf_alert.summary.id

    # old alert summary gets deleted
    old_alert_summary = PerformanceAlertSummary.objects.filter(pk=old_alert_summary_id).first()
    assert old_alert_summary is None


def test_nudge_right_alert_to_changeset_without_alert_summary(client,
                                                              test_sheriff,
                                                              test_perf_alert,
                                                              test_perf_data):
    client.force_authenticate(user=test_sheriff)
    link_alert_summary_in_perf_data(test_perf_data, test_perf_alert,
                                    perf_datum_id=2)

    old_alert_summary_id = test_perf_alert.summary.id

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'push_id': 3,
        'prev_push_id': 2
    })

    assert resp.status_code == 200

    test_perf_alert.refresh_from_db()

    assert test_perf_alert.summary.id != old_alert_summary_id
    assert 'alert_summary_id' in resp.json()
    assert resp.json()['alert_summary_id'] == test_perf_alert.summary.id

    # old alert summary gets deleted
    old_alert_summary = PerformanceAlertSummary.objects.filter(pk=old_alert_summary_id).first()
    assert old_alert_summary is None


def test_nudge_left_alert_to_changeset_with_an_alert_summary(client,
                                                             test_sheriff,
                                                             test_perf_alert,
                                                             test_perf_alert_2,
                                                             test_perf_alert_summary,
                                                             test_perf_alert_summary_2,
                                                             test_perf_data):
    """
    push_ids: 1 [2 summary_2+alert] <-nudge- [3 summary+alert_2] 4
    """
    client.force_authenticate(user=test_sheriff)

    # dump_vars([test_perf_alert_summary, test_perf_alert_summary_2], test_perf_data)
    link_alert_summary_in_perf_data(test_perf_data, test_perf_alert,
                                    perf_datum_id=2)
    link_alert_summary_in_perf_data(test_perf_data, test_perf_alert_2,
                                    perf_datum_id=3)
    associate_perf_data_to_alert(test_perf_data, test_perf_alert_2)
    old_alert_summary_id = test_perf_alert_2.summary.id

    resp = client.put(reverse('performance-alerts-list') + '2/', {
        'push_id': 2,
        'prev_push_id': 1
    })

    assert resp.status_code == 200

    test_perf_alert.refresh_from_db()
    test_perf_alert_2.refresh_from_db()
    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_2.summary.id != old_alert_summary_id
    assert 'alert_summary_id' in resp.json()
    assert resp.json()['alert_summary_id'] == test_perf_alert_2.summary.id

    # old alert summary gets deleted
    old_alert_summary = PerformanceAlertSummary.objects.filter(pk=old_alert_summary_id).first()
    assert old_alert_summary is None

    # prev alert_summary gets properly updated
    assert test_perf_alert_2.summary.id == test_perf_alert_summary.id
    assert test_perf_alert_2.summary.alerts.count() == 2


def test_nudge_right_alert_to_changeset_with_an_alert_summary(client,
                                                              test_sheriff,
                                                              test_perf_alert,
                                                              test_perf_alert_2,
                                                              test_perf_alert_summary,
                                                              test_perf_alert_summary_2,
                                                              test_perf_data):
    """
    push_ids: 1 [2 summary_2+alert] -nudge-> [3 summary+alert_2] 4
    """
    client.force_authenticate(user=test_sheriff)

    old_alert_summary_id = test_perf_alert.summary.id

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'push_id': 3,
        'prev_push_id': 2
    })

    assert resp.status_code == 200

    test_perf_alert.refresh_from_db()
    test_perf_alert_2.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()

    assert test_perf_alert.summary.id != old_alert_summary_id
    assert 'alert_summary_id' in resp.json()
    assert resp.json()['alert_summary_id'] == test_perf_alert.summary.id

    # old alert summary gets deleted
    old_alert_summary = PerformanceAlertSummary.objects.filter(pk=old_alert_summary_id).first()
    assert old_alert_summary is None

    # prev alert_summary gets properly updated
    assert test_perf_alert.summary.id == test_perf_alert_summary_2.id
    assert test_perf_alert.summary.alerts.count() == 2


def test_nudge_left_alert_from_alert_summary_with_more_alerts(client,
                                                              test_sheriff,
                                                              test_perf_alert,
                                                              test_perf_alert_2,
                                                              test_perf_alert_summary,
                                                              test_perf_alert_summary_2,
                                                              test_perf_data):
    associate_perf_data_to_alert(test_perf_data, test_perf_alert_2)

    client.force_authenticate(user=test_sheriff)

    old_alert_summary_id = test_perf_alert_2.summary.id
    test_perf_alert.summary = test_perf_alert_summary_2
    test_perf_alert.save()

    resp = client.put(reverse('performance-alerts-list') + '2/', {
        'push_id': 2,
        'prev_push_id': 1
    })

    assert resp.status_code == 200

    test_perf_alert.refresh_from_db()
    test_perf_alert_2.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()

    assert test_perf_alert_2.summary.id != old_alert_summary_id
    assert 'alert_summary_id' in resp.json()
    assert resp.json()['alert_summary_id'] == test_perf_alert_2.summary.id

    # old alert summary still there
    old_alert_summary = PerformanceAlertSummary.objects.filter(pk=old_alert_summary_id).first()
    assert old_alert_summary is not None
    # with other alert
    assert test_perf_alert in old_alert_summary.alerts.all()

    # prev alert_summary gets properly updated
    assert test_perf_alert_summary_2.alerts.count() == 1


def test_nudge_right_alert_from_alert_summary_with_more_alerts(client,
                                                               test_sheriff,
                                                               test_perf_alert,
                                                               test_perf_alert_2,
                                                               test_perf_alert_summary,
                                                               test_perf_alert_summary_2,
                                                               test_perf_data):
    """
    | push 2          |          | push 3          |
    | --------------- |          | --------------- |
    | | summary     | |          | | summary_2   | |
    | | prev_push=1 | |          | | prev_push=2 | |
    | | ----------- | |          | | ----------- | |
    | | alert       |-|--nudge---|>|_____________| |
    | |_alert_2_____| |          |                 |
    |_________________|          |_________________|
    """

    client.force_authenticate(user=test_sheriff)

    old_alert_summary_id = test_perf_alert.summary.id
    test_perf_alert_2.summary = test_perf_alert_summary
    test_perf_alert_2.save()

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'push_id': 3,
        'prev_push_id': 2
    })

    assert resp.status_code == 200

    test_perf_alert.refresh_from_db()
    test_perf_alert_2.refresh_from_db()
    test_perf_alert_summary.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()

    assert test_perf_alert.summary.id != old_alert_summary_id
    assert 'alert_summary_id' in resp.json()
    assert resp.json()['alert_summary_id'] == test_perf_alert.summary.id

    # old alert summary still there
    old_alert_summary = PerformanceAlertSummary.objects.filter(pk=old_alert_summary_id).first()
    assert old_alert_summary is not None
    # with other alert
    assert test_perf_alert_2 in old_alert_summary.alerts.all()

    # prev alert_summary gets properly updated
    assert test_perf_alert_summary.alerts.count() == 1


def test_nudge_raises_exception_when_no_perf_data(client,
                                                  test_sheriff,
                                                  test_perf_alert,
                                                  test_perf_alert_summary):
    client.force_authenticate(user=test_sheriff)
    initial_summary_count = PerformanceAlertSummary.objects.all().count()
    initial_alert_count = PerformanceAlert.objects.all().count()

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'push_id': 3,
        'prev_push_id': 2
    })

    assert resp.status_code == 400
    assert PerformanceAlertSummary.objects.all().count() == initial_summary_count
    assert PerformanceAlert.objects.all().count() == initial_alert_count


def test_nudge_recalculates_alert_properties(client,
                                             test_sheriff,
                                             test_perf_alert,
                                             test_perf_alert_summary,
                                             test_perf_data):

    def get_alert_properties(test_perf_alert):
        prop_names = ['amount_pct', 'amount_abs', 'prev_value', 'new_value', 't_value']
        return [getattr(test_perf_alert, prop_name) for prop_name in prop_names]

    client.force_authenticate(user=test_sheriff)
    alert_properties = get_alert_properties(test_perf_alert)

    # let's update the performance data
    # so that recalculation produces new results
    for index, perf_datum in enumerate(test_perf_data):
        perf_datum.value = index * 10 + 25
        perf_datum.save()

    resp = client.put(reverse('performance-alerts-list') + '1/', {
        'push_id': 3,
        'prev_push_id': 2
    })
    assert resp.status_code == 200
    test_perf_alert.refresh_from_db()

    new_alert_properties = get_alert_properties(test_perf_alert)
    assert alert_properties != new_alert_properties


# utils
def link_alert_summary_in_perf_data(test_perf_data, test_perf_alert,
                                    perf_datum_id):
    assert perf_datum_id > 0

    perf_datum = filter(lambda tpd: tpd.id == perf_datum_id, test_perf_data)[0]
    prev_perf_datum = filter(lambda tpd: tpd.id == perf_datum_id-1, test_perf_data)[0]

    # adjust relations
    alert_summary = test_perf_alert.summary
    alert_summary.repository = perf_datum.repository
    alert_summary.push = perf_datum.push
    alert_summary.prev_push = prev_perf_datum.push
    alert_summary.save()


def associate_perf_data_to_alert(test_perf_data, test_perf_alert):
    series_signature = test_perf_alert.series_signature

    for perf_datum in test_perf_data:
        perf_datum.signature = series_signature
        perf_datum.save()


def dump_vars(alert_summaries, perf_data, alerts=None):
    from pprint import pprint

    def dump_alert(alert):
        pprint('Alert(id={0.id}, summary_id={0.summary_id}, push_id={0.summary.push_id}, prev_push_id={0.summary.prev_push_id})'.format(alert))

    for summary in alert_summaries:
        pprint('AlertSummary(id={0.id}, push_id={0.push_id}, prev_push_id={0.prev_push_id}) has following alerts: '.format(summary))
        for alert in summary.alerts.all():
            dump_alert(alert)

    if alerts is not None:
        for alert in alerts:
            dump_alert(alert)

    for perf_datum in perf_data:
        pprint('PerfData(id={0.push_id}, push_timestamp={0.push_timestamp})'.format(perf_datum))
