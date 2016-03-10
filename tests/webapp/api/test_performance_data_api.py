import datetime

import pytest
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.perf.models import PerformanceSignature


@pytest.fixture
def subtests_perf_signature(test_perf_signature):
    # summary performance signature don't have test value
    signature = PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=(40*'s'),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite='mysuite',
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


def test_summary_performance_data(webapp, test_repository, subtests_perf_signature,
                                  test_perf_signature, jm):
    summary_signature_hash = subtests_perf_signature.parent_signature.signature_hash
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

    summary_test_data = resp.data[summary_signature_hash]
    assert summary_test_data['subtest_signatures'][0] == test_perf_signature.signature_hash
    assert summary_test_data.keys() == ['suite',
                                        'subtest_signatures',
                                        'option_collection_hash',
                                        'framework_id',
                                        'machine_platform']
