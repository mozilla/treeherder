import datetime
import time

from treeherder.model.models import Push
from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum)


def _verify_alert(alertid, expected_push_id, expected_prev_push_id,
                  expected_signature, expected_prev_value,
                  expected_new_value, expected_is_regression,
                  expected_status, expected_summary_status,
                  expected_classifier):
    alert = PerformanceAlert.objects.get(id=alertid)
    assert alert.prev_value == expected_prev_value
    assert alert.new_value == expected_new_value
    assert alert.series_signature == expected_signature
    assert alert.series_signature.extra_options == expected_signature.extra_options
    assert alert.is_regression == expected_is_regression
    assert alert.status == expected_status
    assert alert.classifier == expected_classifier

    summary = PerformanceAlertSummary.objects.get(id=alertid)
    assert summary.push_id == expected_push_id
    assert summary.prev_push_id == expected_prev_push_id
    assert summary.status == expected_summary_status


def _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_timestamp, start_id, value, amount):
    for (t, v) in zip([i for i in range(start_id, start_id + amount)],
                      [value for i in range(start_id, start_id + amount)]):
        push, _ = Push.objects.get_or_create(
            repository=test_repository,
            revision='1234abcd%s' % t,
            defaults={
                'author': 'foo@bar.com',
                'time': datetime.datetime.fromtimestamp(base_timestamp + t)
            })
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            push=push,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.utcfromtimestamp(
                base_timestamp + t),
            value=v)


def test_detect_alerts_in_series(test_repository,
                                 failure_classifications,
                                 generic_reference_data,
                                 test_perf_signature):

    base_time = time.time()  # generate it based off current time
    INTERVAL = 30
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, 1, 0.5, INTERVAL/2)
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, (INTERVAL/2) + 1, 1.0, INTERVAL/2)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    _verify_alert(1, (INTERVAL/2)+1, (INTERVAL/2), test_perf_signature, 0.5,
                  1.0, True, PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)

    # verify that no new alerts generated if we rerun
    generate_new_alerts_in_series(test_perf_signature)
    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    _verify_alert(1, (INTERVAL/2)+1, (INTERVAL/2), test_perf_signature, 0.5,
                  1.0, True, PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)

    # add data that should be enough to generate a new alert if we rerun
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, (INTERVAL+1), 2.0, INTERVAL)
    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 2
    assert PerformanceAlertSummary.objects.count() == 2
    _verify_alert(2, INTERVAL+1, INTERVAL, test_perf_signature, 1.0, 2.0,
                  True, PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)


def test_detect_alerts_in_series_with_retriggers(
        test_repository, failure_classifications,
        generic_reference_data, test_perf_signature):

    # sometimes we detect an alert in the middle of a series
    # where there are retriggers, make sure we handle this case
    # gracefully by generating a sequence where the regression
    # "appears" in the middle of a series with the same push
    # to make sure things are calculated correctly
    base_time = time.time()  # generate it based off current time
    for i in range(30):
        _generate_performance_data(test_repository, test_perf_signature,
                                   generic_reference_data,
                                   base_time, 1, 0.5, 1)
    for i in range(20):
        _generate_performance_data(test_repository, test_perf_signature,
                                   generic_reference_data,
                                   base_time, 2, 0.5, 1)
    for i in range(40):
        _generate_performance_data(test_repository, test_perf_signature,
                                   generic_reference_data,
                                   base_time, 2, 1.0, 1)

    generate_new_alerts_in_series(test_perf_signature)
    _verify_alert(1, 2, 1, test_perf_signature, 0.5, 1.0, True,
                  PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)


def test_no_alerts_with_old_data(
        test_repository, failure_classifications,
        generic_reference_data, test_perf_signature):
    base_time = 0  # 1970, too old!
    INTERVAL = 30
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, 1, 0.5, INTERVAL/2)
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, (INTERVAL/2) + 1, 1.0, INTERVAL/2)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 0
    assert PerformanceAlertSummary.objects.count() == 0


def test_custom_alert_threshold(
        test_repository, failure_classifications,
        generic_reference_data, test_perf_signature):

    test_perf_signature.alert_threshold = 200.0
    test_perf_signature.save()

    # under default settings, this set of data would generate
    # 2 alerts, but we'll set an artificially high threshold
    # of 200% that should only generate 1
    INTERVAL = 60
    base_time = time.time()
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, 1, 0.5, INTERVAL/3)
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, (INTERVAL/3) + 1, 0.6, INTERVAL/3)
    _generate_performance_data(test_repository, test_perf_signature,
                               generic_reference_data,
                               base_time, 2*(INTERVAL/3) + 1, 2.0, INTERVAL/3)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
