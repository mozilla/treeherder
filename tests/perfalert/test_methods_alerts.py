import datetime
import time

import treeherder.perf.alerts as alerts_module
from treeherder.model.models import Push
from treeherder.perf.alerts import (
    build_cpd_methods,
    detect_methods_changes,
    equal_voting_strategy,
    generate_new_test_alerts_in_series,
    get_methods_detecting_at_index,
    get_weighted_average_push,
    name_voting_strategy,
)
from treeherder.perf.models import (
    PerformanceAlertSummaryTesting,
    PerformanceAlertTesting,
    PerformanceDatum,
    RevisionDatumTest,
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
    alert = PerformanceAlertTesting.objects.get(id=alertid)
    assert alert.prev_value == expected_prev_value
    assert alert.new_value == expected_new_value
    assert alert.series_signature == expected_signature
    assert alert.series_signature.extra_options == expected_signature.extra_options
    assert alert.is_regression == expected_is_regression
    assert alert.status == expected_status
    assert alert.classifier == expected_classifier
    assert alert.noise_profile == expected_noise_profile

    summary = PerformanceAlertSummaryTesting.objects.get(id=alertid)
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

    generate_new_test_alerts_in_series(test_perf_signature)

    assert PerformanceAlertTesting.objects.count() == 1
    assert PerformanceAlertSummaryTesting.objects.count() == 1
    _verify_alert(
        1,
        (interval / 2) + 1,
        (interval / 2),
        test_perf_signature,
        0.5,
        1.0,
        True,
        PerformanceAlertTesting.UNTRIAGED,
        PerformanceAlertSummaryTesting.UNTRIAGED,
        None,
        "OK",
    )

    # verify that no new alerts generated if we rerun
    generate_new_test_alerts_in_series(test_perf_signature)
    assert PerformanceAlertTesting.objects.count() == 1
    assert PerformanceAlertSummaryTesting.objects.count() == 1
    _verify_alert(
        1,
        (interval / 2) + 1,
        (interval / 2),
        test_perf_signature,
        0.5,
        1.0,
        True,
        PerformanceAlertTesting.UNTRIAGED,
        PerformanceAlertSummaryTesting.UNTRIAGED,
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
    generate_new_test_alerts_in_series(test_perf_signature)

    assert PerformanceAlertTesting.objects.count() == 2
    assert PerformanceAlertSummaryTesting.objects.count() == 2
    _verify_alert(
        2,
        interval + 1,
        interval,
        test_perf_signature,
        1.0,
        2.0,
        True,
        PerformanceAlertTesting.UNTRIAGED,
        PerformanceAlertSummaryTesting.UNTRIAGED,
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

    generate_new_test_alerts_in_series(test_perf_signature)
    _verify_alert(
        1,
        2,
        1,
        test_perf_signature,
        0.5,
        0.875,
        True,
        PerformanceAlertTesting.UNTRIAGED,
        PerformanceAlertSummaryTesting.UNTRIAGED,
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

    generate_new_test_alerts_in_series(test_perf_signature)

    assert PerformanceAlertTesting.objects.count() == 0
    assert PerformanceAlertSummaryTesting.objects.count() == 0


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

    generate_new_test_alerts_in_series(test_perf_signature)

    assert PerformanceAlertTesting.objects.count() == 1
    assert PerformanceAlertSummaryTesting.objects.count() == 1

    # When monitor is true, then alert should not be sheriffed
    # regardless of should_alert settings
    assert [not alert.sheriffed for alert in PerformanceAlertTesting.objects.all()]


def test_high_cons_th_suppresses_alert_on_weak_signal(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    """
    A weak regression (0.5 → 0.6) should be suppressed when
    CONS_TH=6 for the 'equal' voting and should yield an alert when
    the voting strategy is 'priority' because Student Test at least would detect it
    """
    base_time = time.time()
    interval = 30

    _generate_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, int(interval / 2)
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        0.6,
        int(interval / 2),
    )

    generate_new_test_alerts_in_series(test_perf_signature, strategy="equal", cons_th=6, margin=0)

    assert PerformanceAlertTesting.objects.count() == 0
    assert PerformanceAlertSummaryTesting.objects.count() == 0

    generate_new_test_alerts_in_series(
        test_perf_signature, strategy="priority", cons_th=6, margin=0
    )

    assert PerformanceAlertTesting.objects.count() == 1
    assert PerformanceAlertSummaryTesting.objects.count() == 1


def test_low_cons_th_detects_alert_on_weak_signal(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    """
    The same weak regression (0.5 → 0.6) should produce at least one alert
    when CONS_TH=1, since only a single method needs to agree.
    """
    base_time = time.time()
    interval = 30

    _generate_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, int(interval / 2)
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        0.6,
        int(interval / 2),
    )

    generate_new_test_alerts_in_series(test_perf_signature, cons_th=1, margin=1)

    assert PerformanceAlertTesting.objects.count() >= 1
    assert PerformanceAlertSummaryTesting.objects.count() >= 1


def test_cons_th_monotonicity_on_strong_signal(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    """
    For a strong regression (0.5 → 1.0), raising CONS_TH from 1 to 4
    should never increase the alert count — it must be non-increasing.
    """
    base_time = time.time()
    interval = 30
    counts = []

    for cons_th in [1, 2, 3, 4]:
        PerformanceAlertTesting.objects.all().delete()
        PerformanceAlertSummaryTesting.objects.all().delete()
        PerformanceDatum.objects.all().delete()
        Push.objects.filter(repository=test_repository).delete()

        _generate_performance_data(
            test_repository, test_perf_signature, base_time, 1, 0.5, int(interval / 2)
        )
        _generate_performance_data(
            test_repository,
            test_perf_signature,
            base_time,
            int(interval / 2) + 1,
            1.0,
            int(interval / 2),
        )

        generate_new_test_alerts_in_series(test_perf_signature, cons_th=cons_th, margin=1)
        counts.append(PerformanceAlertTesting.objects.count())

    for i in range(len(counts) - 1):
        assert counts[i] >= counts[i + 1], (
            f"Alert count should be non-increasing as cons_th rises, got counts={counts}"
        )


def test_large_margin_does_not_duplicate_alerts_for_single_regression(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    """
    A single step-change with MARGIN=5 should still produce exactly one alert —
    the wide tolerance window should not cause duplicates.
    """
    base_time = time.time()
    interval = 30

    _generate_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, int(interval / 2)
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        1.0,
        int(interval / 2),
    )

    generate_new_test_alerts_in_series(test_perf_signature, cons_th=3, margin=5)

    assert PerformanceAlertTesting.objects.count() == 1
    assert PerformanceAlertSummaryTesting.objects.count() == 1


def test_combined_high_cons_th_low_margin_is_strictest(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
):
    """
    High CONS_TH (5) + low MARGIN (0) is the strictest combination.
    A permissive config (CONS_TH=1, MARGIN=5) on the same weak signal
    should find at least as many alerts as the strict one.
    """
    base_time = time.time()
    interval = 30

    _generate_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, int(interval / 2)
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        0.55,
        int(interval / 2),
    )
    generate_new_test_alerts_in_series(test_perf_signature, cons_th=5, margin=0)
    strict_count = PerformanceAlertTesting.objects.count()

    PerformanceAlertTesting.objects.all().delete()
    PerformanceAlertSummaryTesting.objects.all().delete()
    PerformanceDatum.objects.all().delete()
    Push.objects.filter(repository=test_repository).delete()

    _generate_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, int(interval / 2)
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        0.55,
        int(interval / 2),
    )
    generate_new_test_alerts_in_series(test_perf_signature, cons_th=1, margin=5)
    permissive_count = PerformanceAlertTesting.objects.count()

    assert permissive_count >= strict_count, (
        f"Permissive config should find at least as many alerts as strict config. "
        f"Got strict={strict_count}, permissive={permissive_count}"
    )


def test_margin_deduplication_guard_suppresses_nearby_duplicate_alerts(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    test_perf_signature,
    mock_deviance,
    monkeypatch,
):
    """
    Verifies the deduplication guard in equal_voting_strategy (alerts.py in equal_voting_strategy and priority_voting_strategy functions):
        if any(abs(i - alerted_idx) <= margin for alerted_idx in alerted_indices):
            continue
    Compares create_alert call counts between the real implementation (guard active)
    and a guard-free copy. The guard must suppress at least one redundant call for
    adjacent indices near the detected regression.
    Note: DB row counts cannot be used here because update_or_create silently
    merges duplicate calls with the same push_id regardless of the guard.
    """
    base_time = time.time()
    interval = 30
    margin = 2
    cons_th = 1
    _generate_performance_data(
        test_repository, test_perf_signature, base_time, 1, 0.5, int(interval / 2)
    )
    _generate_performance_data(
        test_repository,
        test_perf_signature,
        base_time,
        int(interval / 2) + 1,
        1.0,
        int(interval / 2),
    )
    series = PerformanceDatum.objects.filter(signature=test_perf_signature).order_by(
        "push_timestamp"
    )
    revision_data = {}
    for d in series:
        if d.push_id not in revision_data:
            revision_data[d.push_id] = RevisionDatumTest(
                int(time.mktime(d.push_timestamp.timetuple())), d.push_id, [], []
            )
        revision_data[d.push_id].values.append(d.value)
    analyzed_series = detect_methods_changes(
        test_perf_signature, list(revision_data.values()), build_cpd_methods()
    )

    def equal_without_guard(
        signature,
        analyzed_series,
        cons_th=3,
        margin=2,
        alerted_indices=None,
        detection_method_naming=None,
        replicates_enabled=False,
    ):
        if not analyzed_series or len(analyzed_series) < 2:
            return
        detection_method_naming = name_voting_strategy(
            "equal", cons_th, margin, replicates_enabled, detection_method_naming
        )
        alerted_indices = alerted_indices if alerted_indices is not None else set()
        for i in range(1, len(analyzed_series)):
            methods_detecting_data = get_methods_detecting_at_index(analyzed_series, i, margin)
            if len(methods_detecting_data) >= cons_th:
                start_idx, end_idx = max(0, i - margin), min(len(analyzed_series) - 1, i + margin)
                weighted_index, prev_index = get_weighted_average_push(
                    analyzed_series, methods_detecting_data, start_idx, end_idx
                )
                if weighted_index is not None:
                    alerts_module.create_alert(
                        signature,
                        analyzed_series,
                        analyzed_series[prev_index],
                        analyzed_series[weighted_index],
                        weighted_index,
                        methods_detecting_data,
                        detection_method_naming,
                    )
                    alerted_indices.add(weighted_index)

    call_counts = {"with_guard": 0, "without_guard": 0}
    original = alerts_module.create_alert
    monkeypatch.setattr(
        alerts_module,
        "create_alert",
        lambda *a, **kw: call_counts.__setitem__("with_guard", call_counts["with_guard"] + 1)
        or original(*a, **kw),
    )
    equal_voting_strategy(test_perf_signature, analyzed_series, cons_th=cons_th, margin=margin)
    PerformanceAlertTesting.objects.all().delete()
    PerformanceAlertSummaryTesting.objects.all().delete()
    monkeypatch.setattr(
        alerts_module,
        "create_alert",
        lambda *a, **kw: call_counts.__setitem__("without_guard", call_counts["without_guard"] + 1)
        or original(*a, **kw),
    )
    equal_without_guard(test_perf_signature, analyzed_series, cons_th=cons_th, margin=margin)
    assert call_counts["without_guard"] > call_counts["with_guard"], (
        f"Deduplication guard missing in equal_voting_strategy (~line 490): "
        f"expected fewer create_alert calls with guard ({call_counts['with_guard']}) "
        f"than without ({call_counts['without_guard']})."
    )
