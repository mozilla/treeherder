import copy
import datetime
import json
import time

import pytest

from tests.test_utils import create_generic_job
from treeherder.etl.perf import store_performance_artifact
from treeherder.model.models import Push, Repository
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceDatum,
    PerformanceFramework,
    PerformanceSignature,
)


def sample_perf_datum(framework_name: str, subtest_value: int = 20.0) -> dict:
    return {
        'job_guid': 'fake_job_guid',
        'name': 'test',
        'type': 'test',
        'blob': {
            'framework': {'name': framework_name},
            'suites': [
                {
                    'name': 'cheezburger metrics',
                    'unit': 'ms',
                    'subtests': [{'name': 'test1', 'value': subtest_value, 'unit': 'ms'}],
                }
            ],
        },
    }


def _generate_perf_data_range(
    test_repository,
    generic_reference_data,
    create_perf_framework=True,
    enable_framework=True,
    add_suite_value=False,
    extra_suite_metadata=None,
    extra_subtest_metadata=None,
    reverse_push_range=False,
    job_tier=None,
):
    framework_name = "cheezburger"
    if create_perf_framework:
        PerformanceFramework.objects.create(name=framework_name, enabled=enable_framework)

    now = int(time.time())

    push_range = range(30)
    if reverse_push_range:
        push_range = reversed(push_range)

    for (i, value) in zip(push_range, [1] * 15 + [2] * 15):
        push_time = datetime.datetime.fromtimestamp(now + i)
        push = Push.objects.create(
            repository=test_repository,
            revision=f"abcdefgh{i}",
            author="foo@bar.com",
            time=push_time,
        )
        job = create_generic_job(
            f"myguid{i}", test_repository, push.id, generic_reference_data, tier=job_tier
        )
        datum = sample_perf_datum(framework_name, value)

        if add_suite_value:
            datum['blob']['suites'][0]['value'] = value
        if extra_suite_metadata:
            datum['blob']['suites'][0].update(extra_suite_metadata)
        if extra_subtest_metadata:
            datum['blob']['suites'][0]['subtests'][0].update(extra_subtest_metadata)

        # the perf data adapter expects deserialized performance data
        submit_datum = copy.copy(datum)
        submit_datum['blob'] = json.dumps({'performance_data': submit_datum['blob']})
        store_performance_artifact(job, submit_datum)


def _verify_signature(
    repo_name,
    framework_name,
    suitename,
    testname,
    option_collection_hash,
    platform,
    lower_is_better,
    extra_opts,
    measurement_unit,
    last_updated=None,
    alert_threshold=None,
    alert_change_type=None,
    min_back_window=None,
    max_back_window=None,
    fore_window=None,
):
    if not extra_opts:
        extra_options = ''
    else:
        extra_options = ' '.join(sorted(extra_opts))

    repository = Repository.objects.get(name=repo_name)
    signature = PerformanceSignature.objects.get(suite=suitename, test=testname)
    assert str(signature.framework) == framework_name
    assert signature.option_collection.option_collection_hash == option_collection_hash
    assert signature.platform.platform == platform
    assert signature.repository == repository
    assert signature.extra_options == extra_options
    assert signature.measurement_unit == measurement_unit
    assert signature.lower_is_better == lower_is_better
    assert signature.alert_threshold == alert_threshold
    assert signature.min_back_window == min_back_window
    assert signature.max_back_window == max_back_window
    assert signature.fore_window == fore_window
    if alert_change_type is not None:
        assert signature.get_alert_change_type_display() == alert_change_type
    else:
        assert signature.alert_change_type is None

    # only verify last updated if explicitly specified
    if last_updated:
        assert signature.last_updated == last_updated


def test_data_from_unregistered_framework_isnt_ingested(
    test_repository, failure_classifications, generic_reference_data
):
    _generate_perf_data_range(test_repository, generic_reference_data, create_perf_framework=False)
    # no errors, but no data either
    assert 0 == PerformanceSignature.objects.all().count()
    assert 0 == PerformanceDatum.objects.all().count()


def test_same_signature_multiple_performance_frameworks(test_repository, perf_job):
    framework_names = ['cheezburger1', 'cheezburger2']
    for framework_name in framework_names:
        PerformanceFramework.objects.create(name=framework_name, enabled=True)
        datum = sample_perf_datum(framework_name)

        # the perf data adapter expects deserialized performance data
        submit_datum = copy.copy(datum)
        submit_datum['blob'] = json.dumps({'performance_data': submit_datum['blob']})

        store_performance_artifact(perf_job, submit_datum)

    # we should have 2 performance signature objects, one for each framework
    # and one datum for each signature
    for framework_name in framework_names:
        s = PerformanceSignature.objects.get(
            framework__name=framework_name,
            repository=test_repository,
            suite='cheezburger metrics',
            test='test1',
        )
        d = PerformanceDatum.objects.get(signature=s)
        assert d.value == 20.0


@pytest.mark.parametrize(
    (
        'alerts_enabled_repository',
        'add_suite_value',
        'extra_suite_metadata',
        'extra_subtest_metadata',
        'job_tier',
        'expected_subtest_alert',
        'expected_suite_alert',
    ),
    [
        # just subtest, no metadata, default settings
        (True, False, None, {}, 1, True, False),
        # unsheriffable job tier won't alert
        (True, False, None, {}, 3, False, False),
        # just subtest, high alert threshold (so no alert)
        (True, False, None, {'alertThreshold': 500.0}, 2, False, False),
        # unsheriffable job tier won't alert
        (True, False, None, {'alertThreshold': 500.0}, 3, False, False),
        # just subtest, but larger min window size
        # (so no alerting)
        (True, False, {}, {'minBackWindow': 100, 'maxBackWindow': 100}, 1, False, False),
        # unsheriffable job tier won't alert
        (True, False, {}, {'minBackWindow': 100, 'maxBackWindow': 100}, 3, False, False),
        # should still alert even if we optionally
        # use a large maximum back window
        (True, False, None, {'minBackWindow': 12, 'maxBackWindow': 100}, 2, True, False),
        # unsheriffable job tier won't alert
        (True, False, None, {'minBackWindow': 12, 'maxBackWindow': 100}, 3, False, False),
        # summary+subtest, no metadata, default settings
        (True, True, {}, {}, 1, False, True),
        # unsheriffable job tier won't alert
        (True, True, {}, {}, 3, False, False),
        # summary+subtest, high alert threshold
        # (so no alert)
        (True, True, {'alertThreshold': 500.0}, {}, 2, False, False),
        # unsheriffable job tier won't alert
        (True, True, {'alertThreshold': 500.0}, {}, 3, False, False),
        # unsheriffable job tier won't alert
        (True, True, {'alertThreshold': 500.0}, {}, 2, False, False),
        # unsheriffable job tier won't alert
        (True, True, {'alertThreshold': 500.0}, {}, 3, False, False),
        # summary+subtest, no metadata, no alerting on summary
        (True, True, {'shouldAlert': False}, {}, 1, False, False),
        # unsheriffable job tier won't alert
        (True, True, {'shouldAlert': False}, {}, 3, False, False),
        # summary+subtest, no metadata, no alerting on
        # summary, alerting on subtest
        (True, True, {'shouldAlert': False}, {'shouldAlert': True}, 2, True, False),
        # unsheriffable job tier won't alert
        (True, True, {'shouldAlert': False}, {'shouldAlert': True}, 3, False, False),
        # summary+subtest, no metadata on summary, alerting
        # override on subtest
        (True, True, {}, {'shouldAlert': True}, 2, True, True),
        # unsheriffable job tier won't alert
        (True, True, {}, {'shouldAlert': True}, 3, False, False),
        # summary+subtest, alerting override on subtest +
        # summary
        (True, True, {'shouldAlert': True}, {'shouldAlert': True}, 1, True, True),
        # unsheriffable job tier won't alert
        (True, True, {'shouldAlert': True}, {'shouldAlert': True}, 3, False, False),
        # summary+subtest, alerting override on subtest +
        # summary -- but alerts disabled
        (False, True, {'shouldAlert': True}, {'shouldAlert': True}, 2, False, False),
        # unsheriffable job tier won't alert
        (False, True, {'shouldAlert': True}, {'shouldAlert': True}, 3, False, False),
        # summary+subtest, alerting override on subtest +
        # summary, but using absolute change so shouldn't
        # alert
        (
            True,
            True,
            {'shouldAlert': True, 'alertChangeType': 'absolute'},
            {'shouldAlert': True, 'alertChangeType': 'absolute'},
            1,
            False,
            False,
        ),
        # unsheriffable job tier won't alert
        (
            True,
            True,
            {'shouldAlert': True, 'alertChangeType': 'absolute'},
            {'shouldAlert': True, 'alertChangeType': 'absolute'},
            3,
            False,
            False,
        ),
        # summary + subtest, only subtest is absolute so
        # summary should alert
        (
            True,
            True,
            {'shouldAlert': True},
            {'shouldAlert': True, 'alertChangeType': 'absolute'},
            2,
            False,
            True,
        ),
        # unsheriffable job tier won't alert
        (
            True,
            True,
            {'shouldAlert': True},
            {'shouldAlert': True, 'alertChangeType': 'absolute'},
            3,
            False,
            False,
        ),
    ],
)
def test_alert_generation(
    test_repository,
    test_issue_tracker,
    failure_classifications,
    generic_reference_data,
    alerts_enabled_repository,
    add_suite_value,
    extra_suite_metadata,
    extra_subtest_metadata,
    job_tier,
    expected_subtest_alert,
    expected_suite_alert,
):
    test_repository.performance_alerts_enabled = alerts_enabled_repository
    test_repository.save()

    _generate_perf_data_range(
        test_repository,
        generic_reference_data,
        add_suite_value=add_suite_value,
        extra_suite_metadata=extra_suite_metadata,
        extra_subtest_metadata=extra_subtest_metadata,
        job_tier=job_tier,
    )

    # validate that the signatures have the expected properties
    _verify_signature(
        test_repository.name,
        'cheezburger',
        'cheezburger metrics',
        'test1',
        'my_option_hash',
        'my_platform',
        True,
        None,
        'ms',
        alert_threshold=extra_subtest_metadata.get('alertThreshold'),
        alert_change_type=extra_subtest_metadata.get('alertChangeType'),
        min_back_window=extra_subtest_metadata.get('minBackWindow'),
        max_back_window=extra_subtest_metadata.get('maxBackWindow'),
        fore_window=extra_subtest_metadata.get('foreWindow'),
    )
    if add_suite_value:
        _verify_signature(
            test_repository.name,
            'cheezburger',
            'cheezburger metrics',
            '',
            'my_option_hash',
            'my_platform',
            True,
            None,
            'ms',
            alert_threshold=extra_suite_metadata.get('alertThreshold'),
            alert_change_type=extra_suite_metadata.get('alertChangeType'),
            min_back_window=extra_suite_metadata.get('minBackWindow'),
            max_back_window=extra_suite_metadata.get('maxBackWindow'),
            fore_window=extra_suite_metadata.get('foreWindow'),
        )

    expected_num_alerts = sum([expected_suite_alert, expected_subtest_alert])

    # validate that a performance alert was generated
    assert expected_num_alerts == PerformanceAlert.objects.all().count()

    # check # of alerts, validate summary if present
    if expected_num_alerts > 0:
        assert 1 == PerformanceAlertSummary.objects.all().count()
        summary = PerformanceAlertSummary.objects.get(id=1)
        assert summary.push_id == 16
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


def test_alert_generation_repo_no_alerts(
    test_repository, failure_classifications, generic_reference_data
):
    # validates that no alerts generated on "try" repos
    test_repository.performance_alerts_enabled = False
    test_repository.save()

    _generate_perf_data_range(test_repository, generic_reference_data)

    assert 0 == PerformanceAlert.objects.all().count()
    assert 0 == PerformanceAlertSummary.objects.all().count()


def test_framework_not_enabled(test_repository, failure_classifications, generic_reference_data):
    # The field enabled has been defaulted to 'False'
    _generate_perf_data_range(
        test_repository, generic_reference_data, create_perf_framework=True, enable_framework=False
    )

    assert 0 == PerformanceSignature.objects.all().count()
    assert 0 == PerformanceDatum.objects.all().count()


def test_last_updated(
    test_repository, test_issue_tracker, failure_classifications, generic_reference_data
):
    _generate_perf_data_range(test_repository, generic_reference_data, reverse_push_range=True)
    assert PerformanceSignature.objects.count() == 1
    signature = PerformanceSignature.objects.first()
    assert signature.last_updated == max(Push.objects.values_list('time', flat=True))
