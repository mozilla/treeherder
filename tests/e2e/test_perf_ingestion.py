import copy

from treeherder.etl.jobs import store_job_data
from treeherder.perf.models import PerformanceDatum, PerformanceFramework, PerformanceSignature

# TODO: Turn these into end to end taskcluster tests as part of removing buildbot
# support in bug 1443251, or else delete them if they're duplicating coverage.


def test_store_perf_artifact(test_repository, failure_classifications, push_stored):
    PerformanceFramework.objects.get_or_create(name='cheezburger', enabled=True)

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    job_data = {
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'project': test_repository.name,
            'option_collection': {'opt': True},
            'artifacts': [
                {
                    'blob': {
                        "performance_data": {
                            "framework": {"name": "cheezburger"},
                            "suites": [
                                {
                                    "name": "cheezburger metrics",
                                    "value": 10.0,
                                    "subtests": [
                                        {"name": "test1", "value": 20.0},
                                        {"name": "test2", "value": 30.0},
                                    ],
                                }
                            ],
                        }
                    },
                    'type': 'json',
                    'name': 'performance_data',
                    'job_guid': job_guid,
                }
            ],
        },
    }

    store_job_data(test_repository, [job_data])

    # we'll just validate that we got the expected number of results
    # (we have validation elsewhere for the actual data adapters)
    assert PerformanceSignature.objects.all().count() == 3
    assert PerformanceDatum.objects.all().count() == 3


def test_store_perf_artifact_multiple(test_repository, failure_classifications, push_stored):
    PerformanceFramework.objects.get_or_create(name='cheezburger', enabled=True)
    perfobj = {
        "framework": {"name": "cheezburger"},
        "suites": [
            {
                "name": "cheezburger metrics",
                "value": 10.0,
                "subtests": [{"name": "test1", "value": 20.0}, {"name": "test2", "value": 30.0}],
            }
        ],
    }
    perfobj2 = copy.deepcopy(perfobj)
    perfobj2['suites'][0]['name'] = "cheezburger metrics 2"
    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    job_data = {
        'project': test_repository.name,
        'revision': push_stored[0]['revision'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'project': test_repository.name,
            'option_collection': {'opt': True},
            'artifacts': [
                {
                    'blob': {"performance_data": [perfobj, perfobj2]},
                    'type': 'json',
                    'name': 'performance_data',
                    'job_guid': job_guid,
                }
            ],
        },
    }

    store_job_data(test_repository, [job_data])

    # we'll just validate that we got the expected number of results
    # (we have validation elsewhere for the actual data adapters)
    assert PerformanceSignature.objects.all().count() == 6
    assert PerformanceDatum.objects.all().count() == 6
