from tests.sampledata import SampleData
from treeherder.client.thclient import client
from treeherder.perf.models import (PerformanceSignature, PerformanceDatum)

from test_client_job_ingestion import do_post_collection


def test_post_talos_artifact(test_project, test_repository, result_set_stored,
                             mock_post_json):
    test_repository.save()

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision_hash': result_set_stored[0]['revision_hash'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'project': test_repository.name,
            'option_collection': {'opt': True},
            'artifacts': [{
                'blob': {'talos_data': SampleData.get_minimal_talos_perf_data()},
                'type': 'json',
                'name': 'talos_data',
                'job_guid': job_guid
            }]
        }
    })

    tjc.add(tj)

    do_post_collection(test_project, tjc)

    # we'll just validate that we got the expected number of results for
    # talos (we have validation elsewhere for the actual data adapters)
    assert PerformanceSignature.objects.all().count() == 2
    assert PerformanceDatum.objects.all().count() == 2
