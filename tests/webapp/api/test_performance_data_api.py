import datetime

import pytest
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.model.models import MachinePlatform
from treeherder.perf.models import (PerformanceFramework,
                                    PerformanceSignature)


@pytest.fixture
def summary_perf_signature(test_perf_signature):
    # summary performance signature don't have test value
    signature = PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=(40*'s'),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite='mysuite',
        test='',
        has_subtests=True,
        last_updated=datetime.datetime.now()
    )
    test_perf_signature.parent_signature = signature
    test_perf_signature.save()
    return test_perf_signature


def test_no_summary_performance_data(webapp, test_perf_signature,
                                     jm):

    resp = webapp.get(reverse('performance-signatures-list',
                              kwargs={"project": jm.project}))
    assert resp.status_int == 200

    assert resp.json.get('subtests', None) is None
    assert len(resp.json.keys()) == 1
    assert resp.json.keys()[0] == test_perf_signature.signature_hash
    assert resp.json[test_perf_signature.signature_hash].keys() == ['test',
                                                                    'suite',
                                                                    'option_collection_hash',
                                                                    'framework_id',
                                                                    'machine_platform']


def test_performance_platforms(webapp, test_perf_signature):
    resp = webapp.get(reverse('performance-signatures-platforms-list',
                              kwargs={
                                  "project": test_perf_signature.repository.name
                              }))
    assert resp.status_int == 200
    assert resp.json == ['win7']


def test_performance_platforms_expired_test(webapp, test_perf_signature):
    # check that we have no performance platform if the signatures are too old
    test_perf_signature.last_updated = datetime.datetime.fromtimestamp(0)
    test_perf_signature.save()
    resp = webapp.get(reverse('performance-signatures-platforms-list',
                              kwargs={
                                  "project": test_perf_signature.repository.name
                              }) + '?interval={}'.format(86400))
    assert resp.status_int == 200
    assert resp.json == []


def test_performance_platforms_framework_filtering(webapp, test_perf_signature):
    # check framework filtering
    framework2 = PerformanceFramework.objects.create(name='test_talos2')
    platform2 = MachinePlatform.objects.create(
        os_name='win',
        platform='win7-a',
        architecture='x86',
        active_status='active')
    PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=test_perf_signature.signature_hash,
        framework=framework2,
        platform=platform2,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test=test_perf_signature.test,
        has_subtests=test_perf_signature.has_subtests,
        last_updated=test_perf_signature.last_updated)

    # by default should return both
    resp = webapp.get(reverse('performance-signatures-platforms-list',
                              kwargs={
                                  "project": test_perf_signature.repository.name
                              }))
    assert resp.status_int == 200
    assert sorted(resp.json) == ['win7', 'win7-a']

    # if we specify just one framework, should only return one
    resp = webapp.get(reverse('performance-signatures-platforms-list',
                              kwargs={
                                  "project": test_perf_signature.repository.name
                              }) + '?framework={}'.format(framework2.id))
    assert resp.status_int == 200
    assert resp.json == ['win7-a']


def test_summary_performance_data(webapp, test_repository,
                                  summary_perf_signature,
                                  test_perf_signature, jm):
    summary_signature_hash = summary_perf_signature.parent_signature.signature_hash
    resp = webapp.get(reverse('performance-signatures-list',
                              kwargs={"project": jm.project}))
    assert resp.status_int == 200

    client = APIClient()
    resp = client.get(reverse('performance-signatures-list',
                              kwargs={"project": jm.project}), fromat='json')
    assert resp.status_code == 200

    assert len(resp.data.keys()) == 2
    assert resp.data.keys() == [test_perf_signature.signature_hash,
                                summary_signature_hash]

    summary_properties = resp.data[summary_signature_hash]
    assert summary_properties == {
        'suite': 'mysuite',
        'option_collection_hash': summary_perf_signature.option_collection.option_collection_hash,
        'framework_id': summary_perf_signature.framework_id,
        'machine_platform': summary_perf_signature.platform.platform,
        'has_subtests': True
    }
    subtest_properties = resp.data[test_perf_signature.signature_hash]
    assert subtest_properties == {
        'suite': 'mysuite',
        'test': 'mytest',
        'option_collection_hash': summary_perf_signature.option_collection.option_collection_hash,
        'framework_id': summary_perf_signature.framework_id,
        'machine_platform': summary_perf_signature.platform.platform,
        'parent_signature': summary_signature_hash
    }


def test_filter_by_framework(webapp, test_repository, test_perf_signature):
    # add a a new signature, the same as the test_perf_signature in every
    # way, except it belongs to a different "framework"
    new_framework = PerformanceFramework.objects.create(
        name='test_talos_2')
    signature2 = PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=test_perf_signature.signature_hash,
        framework=new_framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test=test_perf_signature.test,
        has_subtests=test_perf_signature.has_subtests,
        last_updated=test_perf_signature.last_updated
    )

    client = APIClient()

    # Filter by original framework
    resp = client.get(reverse('performance-signatures-list',
                              kwargs={"project": test_repository.name}) +
                      '?framework=%s' % test_perf_signature.framework.id,
                      format='json')
    assert resp.status_code == 200
    assert len(resp.data.keys()) == 1
    assert resp.data[test_perf_signature.signature_hash]['framework_id'] == test_perf_signature.framework.id

    # Filter by new framework
    resp = client.get(reverse('performance-signatures-list',
                              kwargs={"project": test_repository.name}) +
                      '?framework=%s' % new_framework.id,
                      format='json')
    assert resp.status_code == 200
    assert len(resp.data.keys()) == 1
    assert resp.data[signature2.signature_hash]['framework_id'] == new_framework.id
