import copy

from tests.test_utils import post_collection
from treeherder.client.thclient import client
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)


def test_post_perf_artifact(jobs_ds, test_repository, result_set_stored,
                            mock_post_json):
    PerformanceFramework.objects.get_or_create(name='cheezburger', enabled=True)

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'project': test_repository.name,
            'option_collection': {'opt': True},
            'artifacts': [{
                'blob': {
                    "performance_data": {
                        "framework": {"name": "cheezburger"},
                        "suites": [{
                            "name": "cheezburger metrics",
                            "value": 10.0,
                            "subtests": [
                                {"name": "test1", "value": 20.0},
                                {"name": "test2", "value": 30.0}
                            ]
                        }]
                    }
                },
                'type': 'json',
                'name': 'performance_data',
                'job_guid': job_guid
            }]
        }
    })

    tjc.add(tj)

    post_collection(test_repository.name, tjc)

    # we'll just validate that we got the expected number of results
    # (we have validation elsewhere for the actual data adapters)
    assert PerformanceSignature.objects.all().count() == 3
    assert PerformanceDatum.objects.all().count() == 3


def test_post_perf_artifact_revision_hash(test_repository,
                                          result_set_stored, mock_post_json):
    test_repository.save()
    PerformanceFramework.objects.get_or_create(name='cheezburger', enabled=True)

    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision_hash': result_set_stored[0]['revision'],
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'project': test_repository.name,
            'option_collection': {'opt': True},
            'artifacts': [{
                'blob': {
                    "performance_data": {
                        "framework": {"name": "cheezburger"},
                        "suites": [{
                            "name": "cheezburger metrics",
                            "value": 10.0,
                            "subtests": [
                                {"name": "test1", "value": 20.0},
                                {"name": "test2", "value": 30.0}
                            ]
                        }]
                    }
                },
                'type': 'json',
                'name': 'performance_data',
                'job_guid': job_guid
            }]
        }
    })

    tjc.add(tj)

    post_collection(test_repository.name, tjc)

    # we'll just validate that we got the expected number of results
    # (we have validation elsewhere for the actual data adapters)
    assert PerformanceSignature.objects.all().count() == 3
    assert PerformanceDatum.objects.all().count() == 3


def test_post_perf_artifact_multiple(jobs_ds, test_repository,
                                     result_set_stored, mock_post_json):
    PerformanceFramework.objects.get_or_create(name='cheezburger', enabled=True)
    perfobj = {
        "framework": {"name": "cheezburger"},
        "suites": [{
            "name": "cheezburger metrics",
            "value": 10.0,
            "subtests": [
                {"name": "test1", "value": 20.0},
                {"name": "test2", "value": 30.0}
            ]
        }]
    }
    perfobj2 = copy.deepcopy(perfobj)
    perfobj2['suites'][0]['name'] = "cheezburger metrics 2"
    tjc = client.TreeherderJobCollection()
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tj = client.TreeherderJob({
        'project': test_repository.name,
        'revision': result_set_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'project': test_repository.name,
            'option_collection': {'opt': True},
            'artifacts': [{
                'blob': {
                    "performance_data": [perfobj, perfobj2]
                },
                'type': 'json',
                'name': 'performance_data',
                'job_guid': job_guid
            }]
        }
    })

    tjc.add(tj)

    post_collection(test_repository.name, tjc)

    # we'll just validate that we got the expected number of results
    # (we have validation elsewhere for the actual data adapters)
    assert PerformanceSignature.objects.all().count() == 6
    assert PerformanceDatum.objects.all().count() == 6
