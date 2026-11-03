import datetime

import pytest
from django.utils.timezone import now as django_now

from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceSignature,
)


def add_alert(summary, signature, severity=None):
    signature.alert_severity = severity or PerformanceSignature.NORMAL
    signature.save()

    return PerformanceAlert.objects.create(
        summary=summary,
        series_signature=signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0,
    )


@pytest.mark.parametrize(
    "signature_severity",
    [PerformanceSignature.CRITICAL, PerformanceSignature.SUBCRITICAL, PerformanceSignature.NORMAL],
)
def test_alert_takes_severity_from_its_signature(
    test_perf_alert_summary, test_perf_signature, signature_severity
):
    test_perf_signature.alert_severity = signature_severity
    test_perf_signature.save()

    alert = PerformanceAlert.objects.create(
        summary=test_perf_alert_summary,
        series_signature=test_perf_signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0,
    )

    assert alert.severity == signature_severity


def test_alert_severity_survives_a_signature_change(test_perf_alert, test_perf_signature):
    assert test_perf_alert.severity == PerformanceSignature.NORMAL

    # the signature is overwritten in place on every ingestion
    test_perf_signature.alert_severity = PerformanceSignature.CRITICAL
    test_perf_signature.save()

    test_perf_alert.status = PerformanceAlert.ACKNOWLEDGED
    test_perf_alert.save()
    test_perf_alert.refresh_from_db()

    assert test_perf_alert.severity == PerformanceSignature.NORMAL


def test_alert_keeps_an_explicitly_set_severity(test_perf_alert_summary, test_perf_signature):
    assert test_perf_signature.alert_severity == PerformanceSignature.NORMAL

    alert = PerformanceAlert.objects.create(
        summary=test_perf_alert_summary,
        series_signature=test_perf_signature,
        severity=PerformanceSignature.CRITICAL,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0,
    )

    assert alert.severity == PerformanceSignature.CRITICAL


def test_summary_takes_the_severity_of_its_most_severe_alert(
    test_perf_alert_summary, test_perf_signature, test_perf_signature_2
):
    add_alert(test_perf_alert_summary, test_perf_signature, PerformanceSignature.NORMAL)
    add_alert(test_perf_alert_summary, test_perf_signature_2, PerformanceSignature.CRITICAL)

    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.severity == PerformanceSignature.CRITICAL


def test_summary_severity_still_rises_after_the_first_triage(
    test_perf_alert_summary, test_perf_signature
):
    test_perf_alert_summary.first_triaged = django_now()
    test_perf_alert_summary.save()

    add_alert(test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL)

    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.severity == PerformanceSignature.CRITICAL


def test_critical_alert_shortens_the_summary_deadlines(
    test_perf_alert_summary, test_perf_signature
):
    test_perf_alert_summary.created = django_now()
    test_perf_alert_summary.save()
    normal_triage_due = test_perf_alert_summary.triage_due_date
    normal_bug_due = test_perf_alert_summary.bug_due_date

    add_alert(test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL)

    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.get_due_days() == (1, 2)
    assert test_perf_alert_summary.triage_due_date < normal_triage_due
    assert test_perf_alert_summary.bug_due_date < normal_bug_due


def test_a_normal_summary_keeps_the_current_deadlines(test_perf_alert_summary, test_perf_signature):
    test_perf_alert_summary.created = django_now()
    test_perf_alert_summary.save()
    normal_triage_due = test_perf_alert_summary.triage_due_date

    add_alert(test_perf_alert_summary, test_perf_signature, PerformanceSignature.NORMAL)

    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.get_due_days() == (2, 4)
    assert test_perf_alert_summary.triage_due_date == normal_triage_due


def test_deadline_is_not_shortened_onto_a_date_that_has_passed():
    current = django_now() + datetime.timedelta(days=1)
    already_passed = django_now() - datetime.timedelta(hours=2)

    assert PerformanceAlertSummary._resolve_due_date(current, already_passed) == current


def test_deadline_is_shortened_while_the_shorter_one_is_still_ahead():
    current = django_now() + datetime.timedelta(days=2)
    candidate = django_now() + datetime.timedelta(days=1)

    assert PerformanceAlertSummary._resolve_due_date(current, candidate) == candidate


def test_a_later_deadline_is_still_accepted():
    # `created` gets corrected after the fact, which may push the deadline out
    current = django_now() + datetime.timedelta(days=1)
    candidate = django_now() + datetime.timedelta(days=3)

    assert PerformanceAlertSummary._resolve_due_date(current, candidate) == candidate


def reassign(alert, summary):
    alert.status = PerformanceAlert.REASSIGNED
    alert.related_summary = summary
    alert.save()


def test_reassigning_all_critical_alerts_lowers_the_parent_severity(
    test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature, test_perf_signature_2
):
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )
    add_alert(test_perf_alert_summary, test_perf_signature_2, PerformanceSignature.NORMAL)

    reassign(critical, test_perf_alert_summary_2)

    test_perf_alert_summary.refresh_from_db()
    assert test_perf_alert_summary.severity == PerformanceSignature.NORMAL


def test_reassigned_alert_raises_the_destination_severity(
    test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature
):
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )

    reassign(critical, test_perf_alert_summary_2)

    test_perf_alert_summary_2.refresh_from_db()
    assert test_perf_alert_summary_2.severity == PerformanceSignature.CRITICAL


def test_downstream_alert_does_not_count_toward_the_parent_severity(
    test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature, test_perf_signature_2
):
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )
    add_alert(test_perf_alert_summary, test_perf_signature_2, PerformanceSignature.NORMAL)

    critical.status = PerformanceAlert.DOWNSTREAM
    critical.related_summary = test_perf_alert_summary_2
    critical.save()

    test_perf_alert_summary.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()
    assert test_perf_alert_summary.severity == PerformanceSignature.NORMAL
    assert test_perf_alert_summary_2.severity == PerformanceSignature.CRITICAL


def test_parent_keeps_its_severity_while_a_critical_alert_remains(
    test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature, test_perf_signature_2
):
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )
    add_alert(test_perf_alert_summary, test_perf_signature_2, PerformanceSignature.CRITICAL)

    reassign(critical, test_perf_alert_summary_2)

    test_perf_alert_summary.refresh_from_db()
    assert test_perf_alert_summary.severity == PerformanceSignature.CRITICAL


def test_undoing_a_reassignment_restores_the_parent_and_clears_the_destination(
    test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature, test_perf_signature_2
):
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )
    add_alert(test_perf_alert_summary, test_perf_signature_2, PerformanceSignature.NORMAL)
    reassign(critical, test_perf_alert_summary_2)

    critical.status = PerformanceAlert.UNTRIAGED
    critical.related_summary = None
    critical.save()

    test_perf_alert_summary.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()
    assert test_perf_alert_summary.severity == PerformanceSignature.CRITICAL
    assert test_perf_alert_summary_2.severity is None


def test_parent_deadlines_extend_once_its_critical_alerts_are_reassigned(
    test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature, test_perf_signature_2
):
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )
    add_alert(test_perf_alert_summary, test_perf_signature_2, PerformanceSignature.NORMAL)
    test_perf_alert_summary.refresh_from_db()
    critical_triage_due = test_perf_alert_summary.triage_due_date

    reassign(critical, test_perf_alert_summary_2)

    test_perf_alert_summary.refresh_from_db()
    assert test_perf_alert_summary.get_due_days() == (2, 4)
    assert test_perf_alert_summary.triage_due_date > critical_triage_due


def test_moving_a_reassigned_alert_on_clears_the_summary_it_left(
    test_perf_alert_summary,
    test_perf_alert_summary_2,
    test_perf_alert_summary_3,
    test_perf_signature,
    test_perf_signature_2,
):
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )
    add_alert(test_perf_alert_summary, test_perf_signature_2, PerformanceSignature.NORMAL)
    reassign(critical, test_perf_alert_summary_2)

    reassign(critical, test_perf_alert_summary_3)

    test_perf_alert_summary.refresh_from_db()
    test_perf_alert_summary_2.refresh_from_db()
    test_perf_alert_summary_3.refresh_from_db()
    assert test_perf_alert_summary.severity == PerformanceSignature.NORMAL
    assert test_perf_alert_summary_2.severity is None
    assert test_perf_alert_summary_3.severity == PerformanceSignature.CRITICAL


def test_destination_keeps_its_severity_while_its_own_critical_alert_remains(
    test_perf_alert_summary, test_perf_alert_summary_2, test_perf_signature, test_perf_signature_2
):
    add_alert(test_perf_alert_summary_2, test_perf_signature_2, PerformanceSignature.CRITICAL)
    critical = add_alert(
        test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL
    )
    reassign(critical, test_perf_alert_summary_2)

    critical.status = PerformanceAlert.UNTRIAGED
    critical.related_summary = None
    critical.save()

    test_perf_alert_summary_2.refresh_from_db()
    assert test_perf_alert_summary_2.severity == PerformanceSignature.CRITICAL


def test_summary_severity_is_cleared_when_no_alert_carries_one(
    test_perf_alert_summary, test_perf_signature
):
    alert = add_alert(test_perf_alert_summary, test_perf_signature, PerformanceSignature.CRITICAL)
    # alerts that predate the severity field have a null severity
    PerformanceAlert.objects.filter(pk=alert.pk).update(severity=None)

    test_perf_alert_summary.update_status()
    test_perf_alert_summary.refresh_from_db()

    assert test_perf_alert_summary.severity is None
