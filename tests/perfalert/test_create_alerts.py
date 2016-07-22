import datetime
import time

from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum)


def _verify_alert(alertid, expected_result_set_id,
                  expected_prev_result_set_id,
                  expected_signature, expected_prev_value,
                  expected_new_value, expected_is_regression,
                  expected_status, expected_summary_status,
                  expected_classifier):
    alert = PerformanceAlert.objects.get(id=alertid)
    assert alert.prev_value == expected_prev_value
    assert alert.new_value == expected_new_value
    assert alert.series_signature == expected_signature
    assert alert.is_regression == expected_is_regression
    assert alert.status == expected_status
    assert alert.classifier == expected_classifier

    summary = PerformanceAlertSummary.objects.get(id=alertid)
    assert summary.result_set_id == expected_result_set_id
    assert summary.prev_result_set_id == expected_prev_result_set_id
    assert summary.status == expected_summary_status


def test_detect_alerts_in_series(test_project, test_repository,
                                 test_perf_signature):

    INTERVAL = 30
    now = time.time()
    for (t, v) in zip([i for i in range(INTERVAL)],
                      ([0.5 for i in range(INTERVAL/2)] +
                       [1.0 for i in range(INTERVAL/2)])):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=t,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.fromtimestamp(now + t),
            value=v)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    _verify_alert(1, (INTERVAL/2), (INTERVAL/2)-1, test_perf_signature, 0.5,
                  1.0, True, PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)

    # verify that no new alerts generated if we rerun
    generate_new_alerts_in_series(test_perf_signature)
    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    _verify_alert(1, (INTERVAL/2), (INTERVAL/2)-1, test_perf_signature, 0.5,
                  1.0, True, PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)

    # add data to generate a new alert
    for (t, v) in zip([i for i in range(INTERVAL, INTERVAL*2)],
                      [2.0 for i in range(INTERVAL)]):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=0,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.fromtimestamp(now + t),
            value=v)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 2
    assert PerformanceAlertSummary.objects.count() == 2
    _verify_alert(2, INTERVAL, INTERVAL-1, test_perf_signature, 1.0, 2.0,
                  True, PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)


def test_detect_alerts_in_series_with_retriggers(
        test_project, test_repository, test_perf_signature):

    # sometimes we detect an alert in the middle of a series
    # where there are retriggers, make sure we handle this case
    # gracefully by generating a sequence where the regression
    # "appears" in the middle of a series with the same resultset
    # to make sure things are calculated correctly
    now = time.time()
    for (t, j, v) in zip(
            ([1 for i in range(30)] +
             [2 for i in range(60)]),
            [i for i in range(90)],
            ([0.5 for i in range(50)] +
             [1.0 for i in range(40)])
    ):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=j,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.fromtimestamp(now + t),
            value=v)
    generate_new_alerts_in_series(test_perf_signature)
    _verify_alert(1, 2, 1, test_perf_signature, 0.5, 1.0, True,
                  PerformanceAlert.UNTRIAGED,
                  PerformanceAlertSummary.UNTRIAGED, None)


def test_no_alerts_with_old_data(
        test_project, test_repository, test_perf_signature):
    INTERVAL = 30
    for (t, v) in zip([i for i in range(INTERVAL)],
                      ([0.5 for i in range(INTERVAL/2)] +
                       [1.0 for i in range(INTERVAL/2)])):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=t,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.fromtimestamp(t),
            value=v)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 0
    assert PerformanceAlertSummary.objects.count() == 0


def test_custom_alert_threshold(
        test_project, test_repository, test_perf_signature):

    test_perf_signature.alert_threshold = 200.0
    test_perf_signature.save()

    # under default settings, this set of data would generate
    # 2 alerts, but we'll set an artificially high threshold
    # of 200% that should only generate 1
    INTERVAL = 60
    now = time.time()
    for (t, v) in zip([i for i in range(INTERVAL)],
                      ([0.5 for i in range(INTERVAL/3)] +
                       [0.6 for i in range(INTERVAL/3)] +
                       [2.0 for i in range(INTERVAL/3)])):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=t,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.fromtimestamp(now + t),
            value=v)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
