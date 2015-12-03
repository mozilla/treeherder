import copy
import datetime
import json

import pytest

from tests.sampledata import SampleData
from treeherder.etl.perf import (load_perf_artifacts,
                                 load_talos_artifacts)
from treeherder.model.models import (MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Repository)
from treeherder.perf.models import (PerformanceAlert,
                                    PerformanceAlertSummary,
                                    PerformanceDatum,
                                    PerformanceFramework,
                                    PerformanceSignature)


@pytest.fixture
def perf_option_collection():
    option, _ = Option.objects.get_or_create(name='my_option')
    return OptionCollection.objects.get_or_create(
        option_collection_hash='my_option_hash',
        option=option)[0]


@pytest.fixture
def perf_platform():
    return MachinePlatform.objects.get_or_create(
        os_name="my_os",
        platform="my_platform",
        architecture="x86",
        defaults={
            'active_status': "active"
        })[0]


@pytest.fixture
def perf_job_data():
    return {
        'fake_job_guid': {
            'id': 1,
            'result_set_id': 1,
            'push_timestamp': 1402692388
        }
    }


@pytest.fixture
def perf_reference_data():
    return {
        'option_collection_hash': 'my_option_hash',
        'machine_platform': 'my_platform',
        'property1': 'value1',
        'property2': 'value2',
        'property3': 'value3'
    }


def _generate_perf_data_range(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data):
    framework_name = "cheezburger"
    PerformanceFramework.objects.create(name=framework_name)

    for (i, value) in zip(range(30), [1]*15 + [2]*15):
        perf_job_data = {
            'fake_job_guid': {
                'id': i,
                'result_set_id': i,
                'push_timestamp': i
            }
        }
        datum = {
            'job_guid': 'fake_job_guid',
            'name': 'test',
            'type': 'test',
            'blob': {
                'framework': {'name': framework_name},
                'suites': [
                    {
                        'name': 'cheezburger metrics',
                        'subtests': [
                            {
                                'name': 'test1',
                                'value': value
                            }
                        ]
                    }
                ]
            }
        }
        # the perf data adapter expects unserialized performance data
        submit_datum = copy.copy(datum)
        submit_datum['blob'] = json.dumps({
            'performance_data': submit_datum['blob']
        })
        load_perf_artifacts(test_repository.name, perf_reference_data,
                            perf_job_data, submit_datum)


def _verify_signature_datum(repo_name, framework_name, suitename,
                            testname, option_collection_hash, platform,
                            lower_is_better, value, push_timestamp):
    repository = Repository.objects.get(name=repo_name)
    signature = PerformanceSignature.objects.get(suite=suitename,
                                                 test=testname)
    assert str(signature.framework) == framework_name
    assert signature.option_collection.option_collection_hash == option_collection_hash
    assert signature.platform.platform == platform
    assert signature.last_updated == push_timestamp
    assert signature.repository == repository
    assert signature.lower_is_better == lower_is_better

    datum = PerformanceDatum.objects.get(signature=signature)
    assert datum.value == value
    assert datum.push_timestamp == push_timestamp


def test_load_generic_data(test_project, test_repository,
                           perf_option_collection, perf_platform,
                           perf_job_data, perf_reference_data):
    framework_name = 'cheezburger'
    PerformanceFramework.objects.get_or_create(name=framework_name)

    datum = {
        'job_guid': 'fake_job_guid',
        'name': 'test',
        'type': 'test',
        'blob': {
            'framework': {'name': framework_name},
            'suites': [
                {
                    'name': 'cheezburger metrics',
                    'lowerIsBetter': True,
                    'value': 10.0,
                    'subtests': [
                        {
                            'name': 'test1',
                            'value': 20.0,
                            'lowerIsBetter': True
                        },
                        {
                            'name': 'test2',
                            'value': 30.0,
                            'lowerIsBetter': False
                        },
                        {
                            'name': 'test3',
                            'value': 40.0
                        }
                    ]
                }
            ]
        }
    }

    # the perf data adapter expects unserialized performance data
    submit_datum = copy.copy(datum)
    submit_datum['blob'] = json.dumps({
        'performance_data': submit_datum['blob']
    })

    load_perf_artifacts(test_repository.name, perf_reference_data,
                        perf_job_data, submit_datum)
    assert 4 == PerformanceSignature.objects.all().count()
    assert 1 == PerformanceFramework.objects.all().count()
    framework = PerformanceFramework.objects.all()[0]
    assert framework_name == framework.name

    perf_datum = datum['blob']

    # verify summary, then subtests
    push_timestamp = perf_job_data['fake_job_guid']['push_timestamp']
    pushtime = datetime.datetime.fromtimestamp(push_timestamp)
    _verify_signature_datum(test_repository.name,
                            perf_datum['framework']['name'],
                            perf_datum['suites'][0]['name'],
                            '',
                            'my_option_hash',
                            'my_platform',
                            perf_datum['suites'][0]['lowerIsBetter'],
                            perf_datum['suites'][0]['value'],
                            pushtime)
    for subtest in perf_datum['suites'][0]['subtests']:
        _verify_signature_datum(test_repository.name,
                                perf_datum['framework']['name'],
                                perf_datum['suites'][0]['name'],
                                subtest['name'],
                                'my_option_hash',
                                'my_platform',
                                subtest.get('lowerIsBetter', True),
                                subtest['value'],
                                pushtime)
    summary_signature = PerformanceSignature.objects.get(
        suite=perf_datum['suites'][0]['name'], test='')
    subtest_signatures = PerformanceSignature.objects.exclude(
        id=summary_signature.id).values_list('signature_hash', flat=True)
    subtest_hashes = [subtest_signature.signature_hash
                      for subtest_signature in summary_signature.subtests.all()]
    assert len(subtest_hashes) == 3
    assert sorted(subtest_signatures) == sorted(subtest_hashes)

    # send another datum, a little later, verify that signature's
    # `last_updated` is changed accordingly
    perf_job_data['fake_job_guid']['push_timestamp'] += 1
    load_perf_artifacts(test_repository.name, perf_reference_data,
                        perf_job_data, submit_datum)
    signature = PerformanceSignature.objects.get(
        suite=perf_datum['suites'][0]['name'],
        test=perf_datum['suites'][0]['subtests'][0]['name'])
    signature.last_updated == datetime.datetime.fromtimestamp(push_timestamp + 1)


def test_load_talos_data(test_project, test_repository,
                         perf_option_collection, perf_platform,
                         perf_job_data, perf_reference_data):

    PerformanceFramework.objects.create(name='talos')

    talos_perf_data = SampleData.get_talos_perf_data()
    for talos_datum in talos_perf_data:
        datum = {
            "job_guid": "fake_job_guid",
            "name": "test",
            "type": "test",
            "blob": talos_datum
        }

        # Mimic production environment, the blobs are serialized
        # when the web service receives them
        datum['blob'] = json.dumps({'talos_data': [datum['blob']]})
        load_talos_artifacts(test_repository.name, perf_reference_data,
                             perf_job_data, datum)

        # base: subtests + one extra result for the summary series
        expected_result_count = len(talos_datum["results"]) + 1

        # we create one performance series per counter
        if 'talos_counters' in talos_datum:
            expected_result_count += len(talos_datum["talos_counters"])

        # result count == number of signatures
        assert expected_result_count == PerformanceSignature.objects.all().count()

        expected_push_timestamp = datetime.datetime.fromtimestamp(
            perf_job_data['fake_job_guid']['push_timestamp'])

        # verify that we have signatures for the subtests
        for (testname, results) in talos_datum["results"].iteritems():
            signature = PerformanceSignature.objects.get(test=testname)

            datum = PerformanceDatum.objects.get(signature=signature)
            if talos_datum.get('summary'):
                # if we have a summary, ensure the subtest summary values made
                # it in and that we ingested lowerIsBetter ok (if it was there)
                subtest = talos_datum['summary']['subtests'][testname]
                assert round(subtest['filtered'], 2) == datum.value
                assert signature.lower_is_better == subtest.get('lowerIsBetter', True)
            else:
                # this is an old style talos blob without a summary. these are
                # going away, so I'm not going to bother testing the
                # correctness. however let's at least verify that some values
                # are being generated here
                assert datum.value
            assert datum.push_timestamp == expected_push_timestamp
        # if we have counters, verify that the series for them is as expected
        for (counter, results) in talos_datum.get('talos_counters',
                                                  {}).iteritems():
            signature = PerformanceSignature.objects.get(test=counter)
            datum = PerformanceDatum.objects.get(signature=signature)
            assert round(float(results['mean']), 2) == datum.value
            assert datum.push_timestamp == expected_push_timestamp

        # we should be left with just the summary series
        signature = PerformanceSignature.objects.get(
            test='',
            suite=talos_datum['testrun']['suite'])
        datum = PerformanceDatum.objects.get(signature=signature)
        if talos_datum.get('summary'):
            assert round(talos_datum['summary']['suite'], 2) == datum.value
        else:
            # old style talos blob without summary. again, going away,
            # but let's at least test that we have the value
            assert datum.value

        assert datum.push_timestamp == expected_push_timestamp

        # delete perf objects for next iteration
        PerformanceSignature.objects.all().delete()
        PerformanceDatum.objects.all().delete()


def test_alert_generation(test_project, test_repository,
                          perf_option_collection, perf_platform,
                          perf_reference_data):
    _generate_perf_data_range(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data)

    # validate that a performance alert was generated
    assert 1 == PerformanceAlert.objects.all().count()
    assert 1 == PerformanceAlertSummary.objects.all().count()

    summary = PerformanceAlertSummary.objects.get(id=1)
    assert summary.result_set_id == 15
    assert summary.prev_result_set_id == 14

    alert = PerformanceAlert.objects.get(id=1)
    assert alert.is_regression
    assert alert.amount_abs == 1
    assert alert.amount_pct == 100


def test_alert_generation_try(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data):
    # validates that no alerts generated on "try" repos
    test_repository.repository_group.name = "try"
    test_repository.repository_group.save()

    _generate_perf_data_range(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data)

    assert 0 == PerformanceAlert.objects.all().count()
    assert 0 == PerformanceAlertSummary.objects.all().count()
