import datetime
import time
from types import SimpleNamespace
from unittest import mock

import mozdetect
import pytest
from django.db import transaction
from django.db.utils import OperationalError

from treeherder.model.models import Push
from treeherder.perf import alerts
from treeherder.perf.alerts import (
    AlertProperties,
    generate_new_alerts_in_series,
    get_alert_properties,
    get_detection_alert_properties,
    store_alert,
)
from treeherder.perf.detection_techniques import TTEST, DetectionTechnique
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceDatum,
    PerformanceDatumReplicate,
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
    assert [not alert.sheriffed for alert in PerformanceAlert.objects.all()]


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
    assert [alert.sheriffed for alert in PerformanceAlert.objects.all()]

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


def _generate_regression(test_repository, signature, base_time, interval, gap=False):
    # gap=True skips the push right before the regression, so its detected prev_push is one earlier.
    before = int(interval / 2) - (1 if gap else 0)
    _generate_performance_data(test_repository, signature, base_time, 1, 0.5, before)
    _generate_performance_data(
        test_repository, signature, base_time, int(interval / 2) + 1, 1.0, int(interval / 2)
    )


def test_merges_summary_and_widens_prev_push(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    test_perf_signature_2,
    mock_deviance,
):
    # signature 2 has a gap right before the regression, so it detects an
    # earlier prev push than signature 1 for the same push.
    base_time = time.time()
    interval = 30

    _generate_regression(test_repository, test_perf_signature, base_time, interval)
    generate_new_alerts_in_series(test_perf_signature)
    summary = PerformanceAlertSummary.objects.get()
    assert summary.prev_push_id == int(interval / 2)

    _generate_regression(test_repository, test_perf_signature_2, base_time, interval, gap=True)
    generate_new_alerts_in_series(test_perf_signature_2)

    assert PerformanceAlertSummary.objects.count() == 1
    assert PerformanceAlert.objects.count() == 2
    assert set(PerformanceAlert.objects.values_list("summary_id", flat=True)) == {summary.id}
    summary.refresh_from_db()
    assert summary.prev_push_id == int(interval / 2) - 1


def test_does_not_narrow_prev_push(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    test_perf_signature_2,
    mock_deviance,
):
    # signature 1 has the gap this time, so its prev push is already the
    # earliest; signature 2's later prev push must not narrow it.
    base_time = time.time()
    interval = 30

    _generate_regression(test_repository, test_perf_signature, base_time, interval, gap=True)
    generate_new_alerts_in_series(test_perf_signature)
    summary = PerformanceAlertSummary.objects.get()
    assert summary.prev_push_id == int(interval / 2) - 1

    _generate_regression(test_repository, test_perf_signature_2, base_time, interval)
    generate_new_alerts_in_series(test_perf_signature_2)

    summary.refresh_from_db()
    assert summary.prev_push_id == int(interval / 2) - 1


def test_manually_created_summary_keeps_prev_push(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    test_perf_signature_2,
    mock_deviance,
):
    base_time = time.time()
    interval = 30

    _generate_regression(test_repository, test_perf_signature, base_time, interval)
    push = Push.objects.get(repository=test_repository, revision=f"1234abcd{int(interval / 2) + 1}")
    prev_push = Push.objects.get(
        repository=test_repository, revision=f"1234abcd{int(interval / 2)}"
    )
    summary = PerformanceAlertSummary.objects.create(
        repository=test_repository,
        framework=test_perf_signature.framework,
        push_id=push.id,
        prev_push_id=prev_push.id,
        sheriffed=True,
        manually_created=True,
        created=datetime.datetime.now(),
    )

    # signature 2's gap would otherwise widen prev_push, but this summary
    # was manually created, so it must be left untouched.
    _generate_regression(test_repository, test_perf_signature_2, base_time, interval, gap=True)
    generate_new_alerts_in_series(test_perf_signature_2)

    assert PerformanceAlertSummary.objects.count() == 1
    assert PerformanceAlert.objects.filter(summary=summary).count() == 1
    summary.refresh_from_db()
    assert summary.prev_push_id == prev_push.id


MWU = "mwu"


def _generate_replicated_performance_data(
    test_repository, test_perf_signature, base_time, start_id, value, amount, replicates=10
):
    # Each data point carries `replicates` replicates spread just above its value
    _generate_performance_data(
        test_repository, test_perf_signature, base_time, start_id, value, amount
    )
    for datum in PerformanceDatum.objects.filter(
        signature=test_perf_signature,
        push__revision__in=[f"1234abcd{t}" for t in range(start_id, start_id + amount)],
    ):
        PerformanceDatumReplicate.objects.bulk_create(
            PerformanceDatumReplicate(performance_datum=datum, value=value + 0.01 * i)
            for i in range(replicates)
        )


def test_default_detection_technique_is_ttest(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    _generate_regression(test_repository, test_perf_signature, time.time(), 30)

    generate_new_alerts_in_series(test_perf_signature)

    alert = PerformanceAlert.objects.get()
    assert alert.detection_method == TTEST
    assert alert.t_value is not None


def test_detect_mwu_alerts_in_series(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    test_perf_signature.detection_techniques = ["mwu"]
    test_perf_signature.save()

    base_time = time.time()
    _generate_replicated_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, 10
    )
    _generate_replicated_performance_data(
        test_repository, test_perf_signature, base_time, 11, 1.0, 10
    )

    generate_new_alerts_in_series(test_perf_signature)

    alert = PerformanceAlert.objects.get()
    assert alert.detection_method == MWU
    assert alert.summary.push_id == 11
    assert alert.summary.prev_push_id == 10
    assert alert.is_regression
    # the medians of the replicates on either side of the change
    assert alert.prev_value == pytest.approx(0.545)
    assert alert.new_value == pytest.approx(1.045)
    assert alert.amount_abs == pytest.approx(0.5)
    assert alert.t_value is None
    assert 0 <= alert.confidence <= 0.001
    assert alert.noise_profile == "OK"

    # verify that no new alerts generated if we rerun
    generate_new_alerts_in_series(test_perf_signature)
    assert PerformanceAlert.objects.count() == 1
    assert PerformanceAlertSummary.objects.count() == 1


def test_mwu_alerts_respect_alert_threshold(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    test_perf_signature.detection_techniques = ["mwu"]
    test_perf_signature.alert_threshold = 200.0
    test_perf_signature.save()

    base_time = time.time()
    _generate_replicated_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, 10
    )
    _generate_replicated_performance_data(
        test_repository, test_perf_signature, base_time, 11, 1.0, 10
    )

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.count() == 0


@pytest.mark.parametrize(
    ("detection_techniques", "expected_detection_method"),
    [(["ttest", "mwu"], "ttest,mwu"), (["mwu", "ttest"], "mwu,ttest")],
)
def test_one_alert_per_change_across_techniques(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
    detection_techniques,
    expected_detection_method,
):
    test_perf_signature.detection_techniques = detection_techniques
    test_perf_signature.save()

    base_time = time.time()
    _generate_replicated_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, 15
    )
    _generate_replicated_performance_data(
        test_repository, test_perf_signature, base_time, 16, 1.0, 15
    )

    generate_new_alerts_in_series(test_perf_signature)

    alert = PerformanceAlert.objects.get()
    assert alert.detection_method == expected_detection_method
    assert alert.summary.push_id == 16

    # every technique already found it, so nothing changes on a rerun
    generate_new_alerts_in_series(test_perf_signature)
    assert PerformanceAlert.objects.get().detection_method == expected_detection_method


def test_alert_found_by_another_technique_gets_technique_added(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    _generate_regression(test_repository, test_perf_signature, time.time(), 30)
    push_timestamp = time.time()

    with transaction.atomic():
        store_alert(
            test_perf_signature,
            DetectionTechnique(name=TTEST, technique=TTEST),
            16,
            push_timestamp,
            15,
            push_timestamp,
            get_alert_properties(0.5, 1.0, True),
            "OK",
        )
        store_alert(
            test_perf_signature,
            DetectionTechnique(name=MWU, technique=MWU),
            16,
            push_timestamp,
            15,
            push_timestamp,
            get_alert_properties(0.5, 2.0, True),
            "OK",
        )

        # found again by the T-Test, which updates the alert it described
        store_alert(
            test_perf_signature,
            DetectionTechnique(name=TTEST, technique=TTEST),
            16,
            push_timestamp,
            15,
            push_timestamp,
            get_alert_properties(0.5, 3.0, True),
            "OK",
        )

    alert = PerformanceAlert.objects.get()
    assert alert.detection_method == "ttest,mwu"
    assert alert.new_value == 3.0


def test_technique_added_to_legacy_alert(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    _generate_regression(test_repository, test_perf_signature, time.time(), 30)
    generate_new_alerts_in_series(test_perf_signature)
    # alerts produced before detection methods were recorded
    PerformanceAlert.objects.update(detection_method=None)

    with transaction.atomic():
        store_alert(
            test_perf_signature,
            DetectionTechnique(name=MWU, technique=MWU),
            16,
            time.time(),
            15,
            time.time(),
            get_alert_properties(0.5, 2.0, True),
            "OK",
        )

    alert = PerformanceAlert.objects.get()
    assert alert.detection_method == "ttest,mwu"
    assert alert.new_value == 1.0


def test_mwu_failure_does_not_prevent_ttest_alerts(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
    monkeypatch,
):
    def _fail(*args, **kwargs):
        raise Exception("MWU failed")

    monkeypatch.setattr(alerts, "generate_new_mozdetect_alerts_in_series", _fail)
    test_perf_signature.detection_techniques = ["mwu", "ttest"]
    test_perf_signature.save()
    _generate_regression(test_repository, test_perf_signature, time.time(), 30)

    generate_new_alerts_in_series(test_perf_signature)

    assert PerformanceAlert.objects.get().detection_method == TTEST


def test_detect_alerts_with_any_mozdetect_technique(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
    monkeypatch,
):
    class StepDetector:
        # Reports a change at the first push whose value differs from the first push's
        def __init__(self, timeseries, **kwargs):
            self.timeseries = timeseries

        def detect_changes(self, scale=1.0, **kwargs):
            table = self.timeseries.raw_data
            for previous, (revision, value) in zip(
                table["value"], zip(table["revision"].iloc[1:], table["value"].iloc[1:])
            ):
                if value != previous:
                    return [
                        SimpleNamespace(
                            previous_value=previous * scale,
                            new_value=value * scale,
                            confidence=0.5,
                            location=revision,
                            direction="up",
                            # reported by the detector, so taken over what the
                            # values alone would say
                            optional_detection_info={
                                "change": "improvement",
                                "delta_percentage": 42.0,
                            },
                        )
                    ]
            return []

    monkeypatch.setattr(
        mozdetect, "get_timeseries_detectors", lambda detector_type: {"step": StepDetector}
    )
    test_perf_signature.detection_techniques = [
        {"name": "step-scaled", "technique": "step", "args": {"scale": 2.0}}
    ]
    test_perf_signature.save()
    _generate_regression(test_repository, test_perf_signature, time.time(), 30)

    generate_new_alerts_in_series(test_perf_signature)

    alert = PerformanceAlert.objects.get()
    assert alert.detection_method == "step-scaled"
    assert alert.summary.push_id == 16
    assert alert.summary.prev_push_id == 15
    assert alert.prev_value == 1.0
    assert alert.new_value == 2.0
    assert alert.amount_abs == 1.0
    assert alert.amount_pct == 42.0
    assert not alert.is_regression
    assert alert.confidence == 0.5


def _detection(previous_value, new_value, direction, **optional_detection_info):
    return SimpleNamespace(
        previous_value=previous_value,
        new_value=new_value,
        direction=direction,
        optional_detection_info=optional_detection_info,
    )


@pytest.mark.parametrize(
    ("detection", "lower_is_better", "expected"),
    [
        # only what every detection reports
        (_detection(2.0, 3.0, "up"), True, AlertProperties(50.0, 1.0, True, 2.0, 3.0)),
        (_detection(2.0, 3.0, "up"), False, AlertProperties(50.0, 1.0, False, 2.0, 3.0)),
        (_detection(2.0, 1.0, "down"), True, AlertProperties(50.0, -1.0, False, 2.0, 1.0)),
        (_detection(0.0, 1.0, "up"), True, AlertProperties(0.0, 1.0, True, 0.0, 1.0)),
        # what the detection computed itself takes precedence
        (
            _detection(
                2.0,
                3.0,
                "up",
                delta_value=0.9,
                delta_percentage=-45.0,
                change="improvement",
            ),
            True,
            AlertProperties(45.0, 0.9, False, 2.0, 3.0),
        ),
    ],
)
def test_detection_alert_properties(detection, lower_is_better, expected):
    assert get_detection_alert_properties(detection, lower_is_better) == expected


def test_retryable_mozdetect_failure_is_raised_after_other_techniques(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
    monkeypatch,
):
    def _fail(*args, **kwargs):
        raise OperationalError("connection lost")

    monkeypatch.setattr(alerts, "generate_new_mozdetect_alerts_in_series", _fail)
    test_perf_signature.detection_techniques = ["mwu", "ttest"]
    test_perf_signature.save()
    _generate_regression(test_repository, test_perf_signature, time.time(), 30)

    # raised so that the generate_alerts task retries it
    with pytest.raises(OperationalError):
        generate_new_alerts_in_series(test_perf_signature)

    # but only once the other techniques ran
    assert PerformanceAlert.objects.get().detection_method == TTEST
