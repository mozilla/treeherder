import datetime

import pytest
from django.core.exceptions import ValidationError

from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary)


def test_summary_modification(test_repository, test_perf_signature):
    s = PerformanceAlertSummary.objects.create(
        id=1,
        repository=test_repository,
        prev_result_set_id=0,
        result_set_id=1,
        last_updated=datetime.datetime.now())
    p = PerformanceAlert.objects.create(
        id=1,
        summary=s,
        series_signature=test_perf_signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)

    assert s.bug_number is None
    assert s.status == PerformanceAlertSummary.UNTRIAGED

    # acknowledge alert, make sure summary status is updated
    p.status = PerformanceAlert.ACKNOWLEDGED
    p.save()
    s = PerformanceAlertSummary.objects.get(id=1)
    assert s.status == PerformanceAlertSummary.INVESTIGATING

    # reset alert to untriaged, likewise make sure summary status
    # gets updated
    p.status = PerformanceAlert.UNTRIAGED
    p.save()
    s = PerformanceAlertSummary.objects.get(id=1)
    assert s.status == PerformanceAlertSummary.UNTRIAGED


def test_alert_modification(test_repository, test_perf_signature):
    s = PerformanceAlertSummary.objects.create(
        id=1,
        repository=test_repository,
        prev_result_set_id=0,
        result_set_id=1,
        last_updated=datetime.datetime.now())
    s2 = PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_repository,
        prev_result_set_id=1,
        result_set_id=2,
        last_updated=datetime.datetime.now())
    p = PerformanceAlert.objects.create(
        id=1,
        summary=s,
        series_signature=test_perf_signature,
        is_regression=True,
        amount_pct=0.5,
        amount_abs=50.0,
        prev_value=100.0,
        new_value=150.0,
        t_value=20.0)

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
