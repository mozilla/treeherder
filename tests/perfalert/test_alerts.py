import datetime
import time
from unittest import mock

import pytest

from treeherder.model.models import Push
from treeherder.perf.alerts import generate_new_alerts_in_series
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceDatum,
    PerformanceSignature,
)
from treeherder.perf.utils import BUG_DAYS, TRIAGE_DAYS, calculate_time_to


def _verify_alert(
    alertid,
    expected_push_id,
    expected_prev_push_id,
    expected_signature,
    expected_prev_value,
    expected_new_value,
    expected_is_regression,
    expected_status,
    expected_summary_status,
    expected_classifier,
    expected_noise_profile,
):
    alert = PerformanceAlert.objects.get(id=alertid)
    assert alert.prev_value == expected_prev_value
    assert alert.new_value == expected_new_value
    assert alert.series_signature == expected_signature
    assert alert.series_signature.extra_options == expected_signature.extra_options
    assert alert.is_regression == expected_is_regression
    assert alert.status == expected_status
    assert alert.classifier == expected_classifier
    assert alert.noise_profile == expected_noise_profile

    summary = PerformanceAlertSummary.objects.get(id=alertid)
    assert summary.push_id == expected_push_id
    assert summary.prev_push_id == expected_prev_push_id
    assert summary.status == expected_summary_status
    assert summary.triage_due_date == calculate_time_to(summary.created, TRIAGE_DAYS)
    assert summary.bug_due_date == calculate_time_to(summary.created, BUG_DAYS)


def _generate_performance_data(
    test_repository,
    test_perf_signature,
    base_timestamp,
    start_id,
    value,
    amount,
):
    for t, v in zip(
        [i for i in range(start_id, start_id + amount)],
        [value for i in range(start_id, start_id + amount)],
    ):
        push, _ = Push.objects.get_or_create(
            repository=test_repository,
            revision=f"1234abcd{t}",
            defaults={
                "author": "foo@bar.com",
                "time": datetime.datetime.fromtimestamp(base_timestamp + t),
            },
        )
        PerformanceDatum.objects.create(
            repository=test_repository,
            push=push,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.utcfromtimestamp(base_timestamp + t),
            value=v,
        )


def test_detect_alerts_in_series(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    base_time = time.time()  # generate it based off current time
    interval = 30
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        1,
        0.5,
        int(interval / 2),
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        1.0,
        int(interval / 2),
    )

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    _verify_alert(
        1,
        (interval / 2) + 1,
        (interval / 2),
        test_perf_signature,
        0.5,
        1.0,
        True,
        PerformanceAlert.UNTRIAGED,
        PerformanceAlertSummary.UNTRIAGED,
        None,
        "OK",
    )

    # verify that no new alerts generated if we rerun
    generate_new_alerts_in_series(test_perf_signature)
    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1
    _verify_alert(
        1,
        (interval / 2) + 1,
        (interval / 2),
        test_perf_signature,
        0.5,
        1.0,
        True,
        PerformanceAlert.UNTRIAGED,
        PerformanceAlertSummary.UNTRIAGED,
        None,
        "OK",
    )

    # add data that should be enough to generate a new alert if we rerun
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        (interval + 1),
        2.0,
        interval,
    )
    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 2
    assert PerformanceAlertSummary.objects.count() == 2
    _verify_alert(
        2,
        interval + 1,
        interval,
        test_perf_signature,
        1.0,
        2.0,
        True,
        PerformanceAlert.UNTRIAGED,
        PerformanceAlertSummary.UNTRIAGED,
        None,
        "OK",
    )


def test_detect_alerts_in_series_with_retriggers(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
):
    # sometimes we detect an alert in the middle of a series
    # where there are retriggers, make sure we handle this case
    # gracefully by generating a sequence where the regression
    # "appears" in the middle of a series with the same push
    # to make sure things are calculated correctly
    # (in this case, we're moving from consistent 0.5 to a 0.5/1.0
    # mix)
    base_time = time.time()  # generate it based off current time
    for i in range(20):
        _generate_performance_data(
            test_repository,
            test_perf_signature,
            base_time,
            1,
            0.5,
            1,
        )
    for i in range(5):
        _generate_performance_data(
            test_repository,
            test_perf_signature,
            base_time,
            2,
            0.5,
            1,
        )
    for i in range(15):
        _generate_performance_data(
            test_repository,
            test_perf_signature,
            base_time,
            2,
            1.0,
            1,
        )

    generate_new_alerts_in_series(test_perf_signature)
    _verify_alert(
        1,
        2,
        1,
        test_perf_signature,
        0.5,
        0.875,
        True,
        PerformanceAlert.UNTRIAGED,
        PerformanceAlertSummary.UNTRIAGED,
        None,
        "N/A",
    )


def test_no_alerts_with_old_data(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
):
    base_time = 0  # 1970, too old!
    interval = 30
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        1,
        0.5,
        int(interval / 2),
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        1.0,
        int(interval / 2),
    )

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 0
    assert PerformanceAlertSummary.objects.count() == 0


def test_custom_alert_threshold(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
):
    test_perf_signature.alert_threshold = 200.0
    test_perf_signature.save()

    # under default settings, this set of data would generate
    # 2 alerts, but we'll set an artificially high threshold
    # of 200% that should only generate 1
    interval = 60
    base_time = time.time()
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        1,
        0.5,
        int(interval / 3),
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 3) + 1,
        0.6,
        int(interval / 3),
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        2 * int(interval / 3) + 1,
        2.0,
        int(interval / 3),
    )

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1


@pytest.mark.parametrize(("new_value", "expected_num_alerts"), [(1.0, 1), (0.25, 0)])
def test_alert_change_type_absolute(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    new_value,
    expected_num_alerts,
):
    # modify the test signature to say that we alert on absolute value
    # (as opposed to percentage change)
    test_perf_signature.alert_change_type = PerformanceSignature.ALERT_ABS
    test_perf_signature.alert_threshold = 0.3
    test_perf_signature.save()

    base_time = time.time()  # generate it based off current time
    interval = 30
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        1,
        0.5,
        int(interval / 2),
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        new_value,
        int(interval / 2),
    )

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == expected_num_alerts
    assert PerformanceAlertSummary.objects.count() == expected_num_alerts


def test_alert_monitor_no_sheriff(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
):
    # modify the test signature to have it as a monitored signature, but not sheriffed
    test_perf_signature.monitor = True
    test_perf_signature.should_alert = True
    test_perf_signature.save()

    base_time = time.time()  # generate it based off current time
    interval = 60
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        1,
        0.5,
        int(interval / 2),
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        1.0,
        int(interval / 2),
    )

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1

    # When monitor is true, then alert should not be sheriffed
    # regardless of should_alert settings
    assert [alert.sheriffed == False for alert in PerformanceAlert.objects.all()]


@mock.patch("treeherder.perf.alerts.taskcluster")
def test_alert_emails(
    mocked_taskcluster,
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
):
    mocked_email_client = mock.MagicMock()
    mocked_taskcluster.notify_client_factory.return_value = mocked_email_client

    emails = "fake@email.com fake2@email.com"
    test_perf_signature.alert_notify_emails = emails
    test_perf_signature.save()

    base_time = time.time()  # generate it based off current time
    interval = 60
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        1,
        0.5,
        int(interval / 2),
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        1.0,
        int(interval / 2),
    )

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1

    # When monitor is False, then the alerts should be sheriffed
    assert [alert.sheriffed == True for alert in PerformanceAlert.objects.all()]

    # Make sure the email service was called correctly for 2 emails
    assert mocked_taskcluster.notify_client_factory.call_count == 1
    assert mocked_email_client.email.call_count == 2

    # Ensure that each email specified has an email sent to it
    for email in emails.split():
        assert any(
            [
                email in call_arg[0][0]["address"]
                for call_arg in mocked_email_client.email.call_args_list
            ]
        )
