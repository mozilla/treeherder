import copy
import datetime
import json
import time

import pytest

from treeherder.etl.perf import load_perf_artifacts
from treeherder.model.models import (MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Push,
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
        architecture="x86")[0]


@pytest.fixture
def perf_push(test_repository):
    return Push.objects.create(
        repository=test_repository,
        revision='1234abcd',
        author='foo@bar.com',
        timestamp=datetime.datetime.now())


@pytest.fixture
def perf_job_data(perf_push):
    return {
        'fake_job_guid': {
            'id': 1,
            'push_id': 1
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
                              perf_reference_data,
                              create_perf_framework=True,
                              enable_framework=True,
                              add_suite_value=False,
                              extra_suite_metadata=None,
                              extra_subtest_metadata=None):
    framework_name = "cheezburger"
    if create_perf_framework:
        PerformanceFramework.objects.create(name=framework_name, enabled=enable_framework)

    now = int(time.time())

    for (i, value) in zip(range(30), [1]*15 + [2]*15):
        Push.objects.create(repository=test_repository,
                            revision='abcdefgh%s' % i,
                            author='foo@bar.com',
                            timestamp=datetime.datetime.fromtimestamp(now+i))
        perf_job_data = {
            'fake_job_guid': {
                'id': i,
                'push_id': i + 1,
                'push_timestamp': now + i
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
        if add_suite_value:
            datum['blob']['suites'][0]['value'] = value
        if extra_suite_metadata:
            datum['blob']['suites'][0].update(extra_suite_metadata)
        if extra_subtest_metadata:
            datum['blob']['suites'][0]['subtests'][0].update(
                extra_subtest_metadata)

        # the perf data adapter expects unserialized performance data
        submit_datum = copy.copy(datum)
        submit_datum['blob'] = json.dumps({
            'performance_data': submit_datum['blob']
        })
        load_perf_artifacts(test_repository.name, perf_reference_data,
                            perf_job_data, submit_datum)


def _verify_signature(repo_name, framework_name, suitename,
                      testname, option_collection_hash, platform,
                      lower_is_better, extra_options, last_updated=None,
                      alert_threshold=None, min_back_window=None,
                      max_back_window=None, fore_window=None):
    if not extra_options:
        extra_properties = {}
    else:
        extra_properties = {'test_options': sorted(extra_options)}

    repository = Repository.objects.get(name=repo_name)
    signature = PerformanceSignature.objects.get(suite=suitename,
                                                 test=testname)
    assert str(signature.framework) == framework_name
    assert signature.option_collection.option_collection_hash == option_collection_hash
    assert signature.platform.platform == platform
    assert signature.repository == repository
    assert signature.extra_properties == extra_properties
    assert signature.lower_is_better == lower_is_better
    assert signature.alert_threshold == alert_threshold
    assert signature.min_back_window == min_back_window
    assert signature.max_back_window == max_back_window
    assert signature.fore_window == fore_window
    # only verify last updated if explicitly specified
    if last_updated:
        assert signature.last_updated == last_updated


def _verify_datum(suitename, testname, value, push_timestamp):
    datum = PerformanceDatum.objects.get(
        signature=PerformanceSignature.objects.get(suite=suitename,
                                                   test=testname))
    assert datum.value == value
    assert datum.push_timestamp == push_timestamp


def test_load_generic_data(test_project, test_repository,
                           perf_option_collection, perf_platform,
                           perf_push, perf_job_data, perf_reference_data,
                           jm):
    framework_name = 'cheezburger'
    PerformanceFramework.objects.get_or_create(name=framework_name, enabled=True)

    datum = {
        'job_guid': 'fake_job_guid',
        'name': 'test',
        'type': 'test',
        'blob': {
            'framework': {'name': framework_name},
            'suites': [
                {
                    'name': 'cheezburger metrics',
                    'extraOptions': ['shell', 'e10s'],
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
                },
                {
                    'name': 'cheezburger metrics 2',
                    'lowerIsBetter': False,
                    'value': 10.0,
                    'subtests': [
                        {
                            'name': 'test1',
                            'value': 20.0
                        }
                    ]
                },
                {
                    'name': 'cheezburger metrics 3',
                    'value': 10.0,
                    'subtests': [
                        {
                            'name': 'test1',
                            'value': 20.0
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
    assert 8 == PerformanceSignature.objects.all().count()
    assert 1 == PerformanceFramework.objects.all().count()
    framework = PerformanceFramework.objects.all()[0]
    assert framework_name == framework.name

    perf_datum = datum['blob']

    for suite in perf_datum['suites']:
        # verify summary, then subtests
        _verify_signature(test_repository.name,
                          perf_datum['framework']['name'],
                          suite['name'],
                          '',
                          'my_option_hash',
                          'my_platform',
                          suite.get('lowerIsBetter', True),
                          suite.get('extraOptions'),
                          perf_push.timestamp)
        _verify_datum(suite['name'], '', suite['value'], perf_push.timestamp)
        for subtest in suite['subtests']:
            _verify_signature(test_repository.name,
                              perf_datum['framework']['name'],
                              suite['name'],
                              subtest['name'],
                              'my_option_hash',
                              'my_platform',
                              subtest.get('lowerIsBetter', True),
                              suite.get('extraOptions'),
                              perf_push.timestamp)
            _verify_datum(suite['name'], subtest['name'], subtest['value'],
                          perf_push.timestamp)

    summary_signature = PerformanceSignature.objects.get(
        suite=perf_datum['suites'][0]['name'], test='')
    subtest_signatures = PerformanceSignature.objects.filter(
        parent_signature=summary_signature).values_list('signature_hash', flat=True)
    assert len(subtest_signatures) == 3

    # send another datum, a little later, verify that signature's
    # `last_updated` is changed accordingly
    later_timestamp = datetime.datetime.fromtimestamp(int(time.time()) + 5)
    push = Push.objects.create(
        repository=test_repository,
        revision='1234abcd12',
        author='foo@bar.com',
        timestamp=later_timestamp)
    perf_job_data['fake_job_guid']['push_id'] = push.id
    load_perf_artifacts(test_repository.name, perf_reference_data,
                        perf_job_data, submit_datum)
    signature = PerformanceSignature.objects.get(
        suite=perf_datum['suites'][0]['name'],
        test=perf_datum['suites'][0]['subtests'][0]['name'])
    signature.last_updated == later_timestamp


def test_no_performance_framework(test_project, test_repository,
                                  perf_option_collection, perf_platform,
                                  perf_reference_data):
    _generate_perf_data_range(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data,
                              create_perf_framework=False
                              )
    # no errors, but no data either
    assert 0 == PerformanceSignature.objects.all().count()
    assert 0 == PerformanceDatum.objects.all().count()


def test_same_signature_multiple_performance_frameworks(test_project,
                                                        test_repository,
                                                        perf_option_collection,
                                                        perf_platform,
                                                        perf_job_data,
                                                        perf_reference_data):
    framework_names = ['cheezburger1', 'cheezburger2']
    for framework_name in framework_names:
        PerformanceFramework.objects.create(name=framework_name, enabled=True)
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
                                'value': 20.0,
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

    # we should have 2 performance signature objects, one for each framework
    # and one datum for each signature
    for framework_name in framework_names:
        s = PerformanceSignature.objects.get(framework__name=framework_name,
                                             repository=test_repository,
                                             suite='cheezburger metrics',
                                             test='test1')
        d = PerformanceDatum.objects.get(signature=s)
        assert d.value == 20.0


@pytest.mark.parametrize(('add_suite_value',
                          'extra_suite_metadata',
                          'extra_subtest_metadata',
                          'expected_subtest_alert',
                          'expected_suite_alert'), [
                              # just subtest, no metadata, default settings
                              (False, None, {}, True, False),
                              # just subtest, high alert threshold (so no alert)
                              (False, None, {'alertThreshold': 500.0}, False,
                               False),
                              # just subtest, but larger min window size
                              # (so no alerting)
                              (False, {}, {'minBackWindow': 100,
                                           'maxBackWindow': 100}, False,
                               False),
                              # should still alert even if we optionally
                              # use a large maximum back window
                              (False, None, {'minBackWindow': 12,
                                             'maxBackWindow': 100}, True,
                               False),
                              # summary+subtest, no metadata, default settings
                              (True, {}, {}, False, True),
                              # summary+subtest, high alert threshold
                              # (so no alert)
                              (True, {'alertThreshold': 500.0}, {}, False,
                               False),
                              # summary+subtest, no metadata, no alerting on summary
                              (True, {'shouldAlert': False}, {}, False,
                               False),
                              # summary+subtest, no metadata, no alerting on
                              # summary, alerting on subtest
                              (True, {'shouldAlert': False},
                               {'shouldAlert': True}, True, False),
                              # summary+subtest, no metadata on summary, alerting
                              # override on subtest
                              (True, {}, {'shouldAlert': True}, True, True),
                              # summary+subtest, alerting override on subtest +
                              # summary
                              (True, {'shouldAlert': True},
                               {'shouldAlert': True}, True, True),
                        ])
def test_alert_generation(test_project, test_repository,
                          perf_option_collection, perf_platform,
                          perf_reference_data, add_suite_value,
                          extra_suite_metadata, extra_subtest_metadata,
                          expected_subtest_alert, expected_suite_alert):
    _generate_perf_data_range(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data,
                              add_suite_value=add_suite_value,
                              extra_suite_metadata=extra_suite_metadata,
                              extra_subtest_metadata=extra_subtest_metadata)

    # validate that the signatures have the expected properties
    _verify_signature(test_repository.name,
                      'cheezburger',
                      'cheezburger metrics',
                      'test1',
                      'my_option_hash',
                      'my_platform',
                      True,
                      None,
                      alert_threshold=extra_subtest_metadata.get('alertThreshold'),
                      min_back_window=extra_subtest_metadata.get('minBackWindow'),
                      max_back_window=extra_subtest_metadata.get('maxBackWindow'),
                      fore_window=extra_subtest_metadata.get('foreWindow'))
    if add_suite_value:
        _verify_signature(test_repository.name,
                          'cheezburger',
                          'cheezburger metrics',
                          '',
                          'my_option_hash',
                          'my_platform',
                          True,
                          None,
                          alert_threshold=extra_suite_metadata.get('alertThreshold'),
                          min_back_window=extra_suite_metadata.get('minBackWindow'),
                          max_back_window=extra_suite_metadata.get('maxBackWindow'),
                          fore_window=extra_suite_metadata.get('foreWindow'))

    expected_num_alerts = len(filter(lambda x: x is True, [expected_suite_alert,
                                                           expected_subtest_alert]))

    # validate that a performance alert was generated
    assert expected_num_alerts == PerformanceAlert.objects.all().count()

    # check # of alerts, validate summary if present
    if expected_num_alerts > 0:
        assert 1 == PerformanceAlertSummary.objects.all().count()
        summary = PerformanceAlertSummary.objects.get(id=1)
        assert summary.result_set_id is None
        assert summary.push_id == 16
        assert summary.prev_result_set_id is None
        assert summary.prev_push_id == 15
    else:
        assert 0 == PerformanceAlertSummary.objects.all().count()

    # validate suite alert if it [should be] present
    if expected_suite_alert:
        alert = PerformanceAlert.objects.get(series_signature__test='')
        assert alert.series_signature.suite == 'cheezburger metrics'
        assert alert.series_signature.test == ''
        assert alert.is_regression
        assert alert.amount_abs == 1
        assert alert.amount_pct == 100

    # validate subtest alert if it [should be] present
    if expected_subtest_alert:
        alert = PerformanceAlert.objects.get(series_signature__test='test1')
        assert alert.series_signature.suite == 'cheezburger metrics'
        assert alert.series_signature.test == 'test1'
        assert alert.is_regression
        assert alert.amount_abs == 1
        assert alert.amount_pct == 100


def test_alert_generation_repo_no_alerts(test_project, test_repository,
                                         perf_option_collection, perf_platform,
                                         perf_reference_data):
    # validates that no alerts generated on "try" repos
    test_repository.performance_alerts_enabled = False
    test_repository.save()

    _generate_perf_data_range(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data)

    assert 0 == PerformanceAlert.objects.all().count()
    assert 0 == PerformanceAlertSummary.objects.all().count()


def test_framework_not_enabled(test_project, test_repository,
                               perf_option_collection, perf_platform,
                               perf_reference_data):
    # The field enabled has been defaulted to 'False'
    _generate_perf_data_range(test_project, test_repository,
                              perf_option_collection, perf_platform,
                              perf_reference_data,
                              create_perf_framework=True,
                              enable_framework=False)

    assert 0 == PerformanceSignature.objects.all().count()
    assert 0 == PerformanceDatum.objects.all().count()
