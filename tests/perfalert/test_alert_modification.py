import datetime

import pytest

from django.core.exceptions import ValidationError
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary)
from treeherder.model.models import (MachinePlatform,
                                     Option,
                                     OptionCollection)
from treeherder.perf.models import PerformanceSignature


def repo_ref(transactional_db, reponame, project):
    from treeherder.model.models import Repository, RepositoryGroup
    test_project = "%s_jobs" % project
    RepositoryGroup.objects.create(
        name=reponame,
        description=""
    )

    r = Repository.objects.create(
        dvcs_type="hg",
        name=test_project,
        url="https://hg.mozilla.org/mozilla-central",
        active_status="active",
        codebase="gecko",
        repository_group_id=1,
        description="",
        performance_alerts_enabled=True
    )
    return r


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
    option_1 = Option.objects.create(name='opt1')
    option_2 = Option.objects.create(name='opt2')
    option_collection_1 = OptionCollection.objects.create(
        option_collection_hash='my_option_hash_1',
        option=option_1)
    option_collection_2 = OptionCollection.objects.create(
        option_collection_hash='my_option_hash_2',
        option=option_2)
    platform_1 = MachinePlatform.objects.create(
        os_name='win1',
        platform='win8',
        architecture='x86')
    platform_2 = MachinePlatform.objects.create(
        os_name='win2',
        platform='win7',
        architecture='x86')
    signature1 = PerformanceSignature.objects.create(
        repository=repo_ref('default', "dev1", "test_treeherder_1"),
        signature_hash=(30*'t'),
        framework=test_perf_framework,
        platform=platform_1,
        option_collection=option_collection_1,
        suite='mysuite_1',
        test='mytest_1',
        has_subtests=False,
        last_updated=datetime.datetime.now() + datetime.timedelta(hours=1)
    )
    signature2 = PerformanceSignature.objects.create(
        repository=repo_ref('default', "dev2", "test_treeherder_2"),
        signature_hash=(40*'t'),
        framework=test_perf_framework,
        platform=platform_2,
        option_collection=option_collection_2,
        suite='mysuite_2',
        test='mytest_2',
        has_subtests=False,
        last_updated=datetime.datetime.now()
    )

    # ignore downstream and reassigned to update the summary status
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
                            test_perf_alert_summary, test_perf_alert):
    p = test_perf_alert
    s2 = PerformanceAlertSummary.objects.create(
        id=2,
        repository=test_repository,
        prev_result_set_id=1,
        result_set_id=2,
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
