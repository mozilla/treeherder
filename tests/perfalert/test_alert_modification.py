import datetime

import pytest
from django.core.exceptions import ValidationError

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceSignature)


def test_summary_modification(test_repository, test_perf_signature,
                              test_perf_alert_summary, test_perf_alert):
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


def test_summary_status(test_repository, test_perf_signature,
                        test_perf_alert_summary, test_perf_framework):
    signature1 = test_perf_signature
    signature2 = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40*'u'),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite='mysuite_2',
        test='mytest_2',
        has_subtests=False,
        last_updated=datetime.datetime.now()
    )
    s = test_perf_alert_summary

    a = PerformanceAlert.objects.create(
        summary=s,
        series_signature=signature1,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)

    # this is the test case
    # ignore downstream and reassigned to update the summary status
    a.status = PerformanceAlert.REASSIGNED
    a.related_summary = s
    a.save()
    b = PerformanceAlert.objects.create(
        summary=s,
        series_signature=signature2,
        is_regression=False,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)
    b.status = PerformanceAlert.ACKNOWLEDGED
    b.save()
    s = PerformanceAlertSummary.objects.get(id=1)
    assert s.status == PerformanceAlertSummary.IMPROVEMENT


def test_alert_modification(test_repository, test_perf_signature,
                            test_perf_alert_summary, result_set_stored,
                            test_perf_alert):
    p = test_perf_alert
    s2 = PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_repository,
        prev_push_id=3,
        push_id=4,
        prev_result_set_id=3,
        result_set_id=4,
        last_updated=datetime.datetime.now(),
        manually_created=False)

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
