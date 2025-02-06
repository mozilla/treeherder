import datetime

import pytest
from django.core.exceptions import ValidationError

from tests.conftest import create_perf_alert
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceSignature,
)


def test_summary_modification(
    test_repository, test_perf_signature, test_perf_alert_summary, test_perf_alert
):
    (s, a) = (test_perf_alert_summary, test_perf_alert)

    assert s.bug_number is None
    assert s.status == PerformanceAlertSummary.UNTRIAGED

    # acknowledge alert, make sure summary status is updated
    a.status = PerformanceAlert.ACKNOWLEDGED
    a.save()
    s = PerformanceAlertSummary.objects.get(id=1)
    assert s.status == PerformanceAlertSummary.INVESTIGATING

    # reset alert to untriaged, likewise make sure summary status
    # gets updated
    a.status = PerformanceAlert.UNTRIAGED
    a.save()
    s = PerformanceAlertSummary.objects.get(id=1)
    assert s.status == PerformanceAlertSummary.UNTRIAGED


def test_summary_status(
    test_repository,
    test_perf_signature,
    test_perf_alert_summary,
    test_perf_framework,
    test_perf_alert_summary_2,
):
    signature1 = test_perf_signature
    signature2 = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40 * "u"),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite="mysuite_2",
        test="mytest_2",
        has_subtests=False,
        last_updated=datetime.datetime.now(),
    )
    s = test_perf_alert_summary

    create_perf_alert(
        summary=s,
        series_signature=signature1,
        is_regression=False,
        # this is the test case
        # ignore downstream and reassigned to update the summary status
        related_summary=test_perf_alert_summary_2,
        status=PerformanceAlert.REASSIGNED,
    )

    create_perf_alert(
        summary=s,
        series_signature=signature2,
        is_regression=False,
        status=PerformanceAlert.ACKNOWLEDGED,
    )

    s = PerformanceAlertSummary.objects.get(id=1)
    assert s.status == PerformanceAlertSummary.IMPROVEMENT


def test_reassigning_regression(
    test_repository,
    test_perf_signature,
    test_perf_alert_summary,
    test_perf_framework,
    test_perf_alert_summary_2,
):
    signature1 = test_perf_signature
    signature2 = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40 * "u"),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite="mysuite_2",
        test="mytest_2",
        has_subtests=False,
        last_updated=datetime.datetime.now(),
    )
    s = test_perf_alert_summary

    untriaged_improvement_alert = create_perf_alert(
        summary=s,
        series_signature=signature2,
        is_regression=False,
        status=PerformanceAlert.UNTRIAGED,
    )

    assert s.status == PerformanceAlertSummary.UNTRIAGED

    # reassigning a regression that was in the first summary
    # to the second summary should leave the status as UNTRIAGED
    reassigned_alert = create_perf_alert(
        summary=s,
        series_signature=signature1,
        related_summary=test_perf_alert_summary_2,
        is_regression=True,
        status=PerformanceAlert.REASSIGNED,
    )

    assert s.status == PerformanceAlertSummary.UNTRIAGED

    # acknowledging only the untriaged improvement alert, mimicking the UI behaviour
    # the regression alert will keep it's status of REASSIGNED
    untriaged_improvement_alert.status = PerformanceAlert.ACKNOWLEDGED
    untriaged_improvement_alert.save()
    assert reassigned_alert.status == PerformanceAlert.REASSIGNED

    # Status of the summary with only improvements should automatically
    # have a status of IMPROVEMENT
    s = PerformanceAlertSummary.objects.get(id=1)
    assert s.status == PerformanceAlertSummary.IMPROVEMENT


def test_improvement_summary_status_after_reassigning_regression(
    test_repository,
    test_perf_signature,
    test_perf_alert_summary,
    test_perf_framework,
    test_perf_alert_summary_2,
):
    signature1 = test_perf_signature
    signature2 = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40 * "u"),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite="mysuite_2",
        test="mytest_2",
        has_subtests=False,
        last_updated=datetime.datetime.now(),
    )

    alert = create_perf_alert(
        summary=test_perf_alert_summary,
        series_signature=signature1,
        is_regression=False,
        status=PerformanceAlert.ACKNOWLEDGED,
    )

    assert test_perf_alert_summary.status == PerformanceAlertSummary.IMPROVEMENT

    create_perf_alert(
        summary=test_perf_alert_summary_2,
        series_signature=signature2,
        is_regression=True,
        related_summary=test_perf_alert_summary,
        status=PerformanceAlert.REASSIGNED,
    )

    improvement_alert = PerformanceAlert.objects.get(id=alert.id)
    assert improvement_alert.status == PerformanceAlert.UNTRIAGED
    assert test_perf_alert_summary.status == PerformanceAlertSummary.UNTRIAGED


def test_alert_modification(
    test_perf_signature, test_perf_alert_summary, push_stored, test_perf_alert
):
    p = test_perf_alert
    s2 = PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_perf_alert_summary.repository,
        prev_push_id=3,
        push_id=4,
        created=datetime.datetime.now(),
        framework=test_perf_alert_summary.framework,
        manually_created=False,
    )

    assert p.related_summary is None
    assert p.status == PerformanceAlert.UNTRIAGED

    # set related summary, but no status, make sure an exception is thrown
    p.related_summary = s2
    with pytest.raises(ValidationError):
        p.save()

    # set related summary with downstream status, make sure that works
    p = PerformanceAlert.objects.get(id=1)
    p.status = PerformanceAlert.DOWNSTREAM
    p.related_summary = s2
    p.save()
    p = PerformanceAlert.objects.get(id=1)
    assert p.related_summary.id == 2
    assert p.status == PerformanceAlert.DOWNSTREAM

    # unset related summary, but don't set status, make sure we get
    # another exception
    with pytest.raises(ValidationError):
        p.related_summary = None
        p.save()
    p.status = PerformanceAlert.UNTRIAGED
    p.save()

    # then make sure it succeeds when set
    p = PerformanceAlert.objects.get(id=1)
    assert p.related_summary is None
    assert p.status == PerformanceAlert.UNTRIAGED
