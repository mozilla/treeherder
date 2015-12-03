import datetime
import time

import pytest
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.model.models import (MachinePlatform,
                                     Option,
                                     OptionCollection)
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)


@pytest.fixture
def summary_perf_signature(test_repository, test_perf_signature):

    framework = PerformanceFramework.objects.get(
        name='test_talos')
    option = Option.objects.create(name='opt')
    option_collection = OptionCollection.objects.create(
        option_collection_hash='my_option_hash',
        option=option)
    platform = MachinePlatform.objects.create(
        os_name='win',
        platform='win7',
        architecture='x86',
        active_status='active')

    # summary performance signature don't have test value
    signature = PerformanceSignature.objects.create(
        repository=test_repository,
        signature_hash=(40*'s'),
        framework=framework,
        platform=platform,
        option_collection=option_collection,
        suite='mysuite'
    )
    signature.subtests.add(test_perf_signature)
    return signature


def test_no_summary_performance_date(webapp, test_repository, test_perf_signature,
                                     jm):

    INTERVAL = 30
    now = time.time()
    for (t, v) in zip([i for i in range(INTERVAL)],
                      ([0.5 for i in range(INTERVAL/2)] +
                       [1.0 for i in range(INTERVAL/2)])):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=t,
            signature=test_perf_signature,
            push_timestamp=datetime.datetime.fromtimestamp(now + t),
            value=v
        )

    resp = webapp.get(reverse('performance-signatures-list',
                              kwargs={"project": jm.project}))
    assert resp.status_int == 200

    # we should get only one signature date and it
    # is a no summary test.
    assert resp.json.get('subtests', None) is None
    assert len(resp.json.keys()) == 1
    assert resp.json.keys()[0] == test_perf_signature.signature_hash
    # we don't have test_options and the lower_is_better because they haven't been
    # init when we generate test_perf_signature mock.
    assert resp.json[test_perf_signature.signature_hash].keys() == ['test', 'suite',
                                                                    'option_collection_hash',
                                                                    'machine_platform']


def test_summary_performance_date(webapp, test_repository, summary_perf_signature,
                                  test_perf_signature, jm):
    INTERVAL = 20
    now = time.time()
    for (t, v) in zip([i for i in range(INTERVAL)],
                      ([0.5 for i in range(INTERVAL/2)] +
                       [1.0 for i in range(INTERVAL/2)])):
        PerformanceDatum.objects.create(
            repository=test_repository,
            result_set_id=t,
            job_id=t,
            signature=summary_perf_signature,
            push_timestamp=datetime.datetime.fromtimestamp(now + t),
            value=v
        )

    resp = webapp.get(reverse('performance-signatures-list',
                              kwargs={"project": jm.project}))
    assert resp.status_int == 200

    client = APIClient()
    resp = client.get(reverse('performance-signatures-list',
                              kwargs={"project": jm.project}), fromat='json')

    assert resp.status_code == 200

    # we will get two signatures, one is for summary test and the
    # other on should be no summary test
    assert len(resp.data.keys()) == 2
    assert resp.data.keys() == [test_perf_signature.signature_hash,
                                summary_perf_signature.signature_hash]

    summary_test_data = resp.data[summary_perf_signature.signature_hash]
    assert summary_test_data['subtest_signatures'][0] == test_perf_signature.signature_hash
    assert summary_test_data.keys() == ['suite',
                                        'subtest_signatures',
                                        'option_collection_hash',
                                        'machine_platform'
                                        ]
