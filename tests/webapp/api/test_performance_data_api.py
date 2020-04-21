import datetime

import pytest
from django.urls import reverse

from treeherder.model.models import MachinePlatform, Push
from treeherder.perf.models import PerformanceDatum, PerformanceFramework, PerformanceSignature

NOW = datetime.datetime.now()
ONE_DAY_AGO = NOW - datetime.timedelta(days=1)
THREE_DAYS_AGO = NOW - datetime.timedelta(days=3)
SEVEN_DAYS_AGO = NOW - datetime.timedelta(days=7)


@pytest.fixture
def summary_perf_signature(test_perf_signature):
    # summary performance signature don't have test value
    signature = PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=(40 * 's'),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite='mysuite',
        test='',
        extra_options='e10s shell',
        has_subtests=True,
        last_updated=datetime.datetime.now(),
    )
    test_perf_signature.parent_signature = signature
    test_perf_signature.save()
    return signature


@pytest.fixture
def test_perf_signature_same_hash_different_framework(test_perf_signature):
    # a new signature, same as the test_perf_signature in every
    # way, except it belongs to a different "framework"
    new_framework = PerformanceFramework.objects.create(name='test_talos_2', enabled=True)
    new_signature = PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=test_perf_signature.signature_hash,
        framework=new_framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test=test_perf_signature.test,
        has_subtests=test_perf_signature.has_subtests,
        last_updated=test_perf_signature.last_updated,
    )
    return new_signature


def test_no_summary_performance_data(client, test_perf_signature, test_repository):

    resp = client.get(
        reverse('performance-signatures-list', kwargs={"project": test_repository.name})
    )
    assert resp.status_code == 200
    assert resp.json() == {
        test_perf_signature.signature_hash: {
            'id': test_perf_signature.id,
            'test': test_perf_signature.test,
            'application': test_perf_signature.application,
            'suite': test_perf_signature.suite,
            'tags': test_perf_signature.tags.split(' '),
            'option_collection_hash': test_perf_signature.option_collection.option_collection_hash,
            'framework_id': test_perf_signature.framework.id,
            'machine_platform': test_perf_signature.platform.platform,
            'extra_options': test_perf_signature.extra_options.split(' '),
            'measurement_unit': test_perf_signature.measurement_unit,
        }
    }


def test_performance_platforms(client, test_perf_signature):
    resp = client.get(
        reverse(
            'performance-signatures-platforms-list',
            kwargs={"project": test_perf_signature.repository.name},
        )
    )
    assert resp.status_code == 200
    assert resp.json() == ['win7']


def test_performance_platforms_expired_test(client, test_perf_signature):
    # check that we have no performance platform if the signatures are too old
    test_perf_signature.last_updated = datetime.datetime.utcfromtimestamp(0)
    test_perf_signature.save()
    resp = client.get(
        reverse(
            'performance-signatures-platforms-list',
            kwargs={"project": test_perf_signature.repository.name},
        )
        + '?interval={}'.format(86400)
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_performance_platforms_framework_filtering(client, test_perf_signature):
    # check framework filtering
    framework2 = PerformanceFramework.objects.create(name='test_talos2', enabled=True)
    platform2 = MachinePlatform.objects.create(os_name='win', platform='win7-a', architecture='x86')
    PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=test_perf_signature.signature_hash,
        framework=framework2,
        platform=platform2,
        option_collection=test_perf_signature.option_collection,
        suite=test_perf_signature.suite,
        test=test_perf_signature.test,
        has_subtests=test_perf_signature.has_subtests,
        last_updated=test_perf_signature.last_updated,
    )

    # by default should return both
    resp = client.get(
        reverse(
            'performance-signatures-platforms-list',
            kwargs={"project": test_perf_signature.repository.name},
        )
    )
    assert resp.status_code == 200
    assert sorted(resp.json()) == ['win7', 'win7-a']

    # if we specify just one framework, should only return one
    resp = client.get(
        reverse(
            'performance-signatures-platforms-list',
            kwargs={"project": test_perf_signature.repository.name},
        )
        + '?framework={}'.format(framework2.id)
    )
    assert resp.status_code == 200
    assert resp.json() == ['win7-a']


def test_summary_performance_data(
    client, test_repository, summary_perf_signature, test_perf_signature
):
    summary_signature_hash = summary_perf_signature.signature_hash
    resp = client.get(
        reverse('performance-signatures-list', kwargs={"project": test_repository.name})
    )
    assert resp.status_code == 200

    resp = client.get(
        reverse('performance-signatures-list', kwargs={"project": test_repository.name})
    )
    assert resp.status_code == 200

    assert len(resp.data.keys()) == 2
    assert set(resp.data.keys()) == {test_perf_signature.signature_hash, summary_signature_hash}

    for signature in [summary_perf_signature, test_perf_signature]:
        expected = {
            'id': signature.id,
            'suite': signature.suite,
            'option_collection_hash': signature.option_collection.option_collection_hash,
            'framework_id': signature.framework_id,
            'machine_platform': signature.platform.platform,
        }
        if signature.test:
            expected['test'] = signature.test
        if signature.has_subtests:
            expected['has_subtests'] = True
        if signature.tags:
            # tags stored as charField but api returns as list
            expected['tags'] = signature.tags.split(' ')
        if signature.parent_signature:
            expected['parent_signature'] = signature.parent_signature.signature_hash
        if signature.extra_options:
            # extra_options stored as charField but api returns as list
            expected['extra_options'] = signature.extra_options.split(' ')
        if signature.measurement_unit:
            expected['measurement_unit'] = signature.measurement_unit
        if signature.application:
            expected['application'] = signature.application
        assert resp.data[signature.signature_hash] == expected


def test_filter_signatures_by_framework(
    client, test_repository, test_perf_signature, test_perf_signature_same_hash_different_framework
):
    signature2 = test_perf_signature_same_hash_different_framework

    # Filter by original framework
    resp = client.get(
        reverse('performance-signatures-list', kwargs={"project": test_repository.name})
        + '?framework=%s' % test_perf_signature.framework.id,
    )
    assert resp.status_code == 200
    assert len(resp.data.keys()) == 1
    assert (
        resp.data[test_perf_signature.signature_hash]['framework_id']
        == test_perf_signature.framework.id
    )

    # Filter by new framework
    resp = client.get(
        reverse('performance-signatures-list', kwargs={"project": test_repository.name})
        + '?framework=%s' % signature2.framework.id,
    )
    assert resp.status_code == 200
    assert len(resp.data.keys()) == 1
    assert resp.data[signature2.signature_hash]['framework_id'] == signature2.framework.id


def test_filter_data_by_framework(
    client,
    test_repository,
    test_perf_signature,
    push_stored,
    test_perf_signature_same_hash_different_framework,
):
    signature2 = test_perf_signature_same_hash_different_framework
    push = Push.objects.get(id=1)
    for signature in [test_perf_signature, signature2]:
        PerformanceDatum.objects.create(
            repository=signature.repository,
            push=push,
            result_set_id=1,
            signature=signature,
            value=0.0,
            push_timestamp=push.time,
        )

    # No filtering, return two datapoints (this behaviour actually sucks,
    # but it's "by design" for now, see bug 1265709)
    resp = client.get(
        reverse('performance-data-list', kwargs={"project": test_repository.name})
        + '?signatures='
        + test_perf_signature.signature_hash
    )
    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == 2
    assert set(datum['signature_id'] for datum in datums) == {1, 2}

    # Filtering by first framework
    resp = client.get(
        reverse('performance-data-list', kwargs={"project": test_repository.name})
        + '?signatures={}&framework={}'.format(
            test_perf_signature.signature_hash, test_perf_signature.framework.id
        )
    )
    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == 1
    assert datums[0]['signature_id'] == 1

    # Filtering by second framework
    resp = client.get(
        reverse('performance-data-list', kwargs={"project": test_repository.name})
        + '?signatures={}&framework={}'.format(
            test_perf_signature.signature_hash, signature2.framework.id
        )
    )
    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == 1
    assert datums[0]['signature_id'] == 2


def test_filter_signatures_by_interval(client, test_perf_signature):
    # interval for the last 24 hours, only one signature exists last updated within that timeframe
    resp = client.get(
        reverse(
            'performance-signatures-list', kwargs={"project": test_perf_signature.repository.name}
        )
        + '?interval={}'.format(86400)
    )
    assert resp.status_code == 200
    assert len(resp.json().keys()) == 1
    assert resp.json()[test_perf_signature.signature_hash]['id'] == 1


@pytest.mark.parametrize(
    'start_date, end_date, exp_count, exp_id',
    [(SEVEN_DAYS_AGO, ONE_DAY_AGO, 1, 1), (THREE_DAYS_AGO, '', 1, 1), (ONE_DAY_AGO, '', 0, 0)],
)
def test_filter_signatures_by_range(
    client, test_perf_signature, start_date, end_date, exp_count, exp_id
):
    # set signature last updated to 3 days ago
    test_perf_signature.last_updated = THREE_DAYS_AGO
    test_perf_signature.save()

    resp = client.get(
        reverse(
            'performance-signatures-list', kwargs={"project": test_perf_signature.repository.name}
        )
        + '?start_date={}&end_date={}'.format(start_date, end_date)
    )
    assert resp.status_code == 200
    assert len(resp.json().keys()) == exp_count
    if exp_count != 0:
        assert resp.json()[test_perf_signature.signature_hash]['id'] == exp_id


@pytest.mark.parametrize(
    'interval, exp_datums_len, exp_push_ids', [(86400, 1, [1]), (86400 * 3, 2, [2, 1])]
)
def test_filter_data_by_interval(
    client, test_repository, test_perf_signature, interval, exp_datums_len, exp_push_ids
):
    # create some test data
    for (i, timestamp) in enumerate(
        [NOW, NOW - datetime.timedelta(days=2), NOW - datetime.timedelta(days=7)]
    ):
        push = Push.objects.create(
            repository=test_repository,
            revision='abcdefgh%s' % i,
            author='foo@bar.com',
            time=timestamp,
        )
        PerformanceDatum.objects.create(
            repository=test_perf_signature.repository,
            result_set_id=push.id,
            push=push,
            signature=test_perf_signature,
            value=i,
            push_timestamp=timestamp,
        )

    # going back interval of 1 day, should find 1 item
    resp = client.get(
        reverse('performance-data-list', kwargs={"project": test_repository.name})
        + '?signature_id={}&interval={}'.format(test_perf_signature.id, interval)
    )

    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == exp_datums_len
    for x in range(exp_datums_len):
        assert datums[x]['push_id'] == exp_push_ids[x]


@pytest.mark.parametrize(
    'start_date, end_date, exp_datums_len, exp_push_ids',
    [(SEVEN_DAYS_AGO, THREE_DAYS_AGO, 1, [3]), (THREE_DAYS_AGO, '', 2, [2, 1])],
)
def test_filter_data_by_range(
    client, test_repository, test_perf_signature, start_date, end_date, exp_datums_len, exp_push_ids
):
    # create some test data
    for (i, timestamp) in enumerate(
        [NOW, NOW - datetime.timedelta(days=2), NOW - datetime.timedelta(days=5)]
    ):
        push = Push.objects.create(
            repository=test_repository,
            revision='abcdefgh%s' % i,
            author='foo@bar.com',
            time=timestamp,
        )
        PerformanceDatum.objects.create(
            repository=test_perf_signature.repository,
            result_set_id=push.id,
            push=push,
            signature=test_perf_signature,
            value=i,
            push_timestamp=timestamp,
        )

    resp = client.get(
        reverse('performance-data-list', kwargs={"project": test_repository.name})
        + '?signature_id={}&start_date={}&end_date={}'.format(
            test_perf_signature.id, start_date, end_date
        )
    )

    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == exp_datums_len
    for x in range(exp_datums_len):
        assert datums[x]['push_id'] == exp_push_ids[x]


def test_job_ids_validity(client, test_repository):
    resp = client.get(
        reverse('performance-data-list', kwargs={"project": test_repository.name}) + '?job_id=1'
    )
    assert resp.status_code == 200

    resp = client.get(
        reverse('performance-data-list', kwargs={"project": test_repository.name}) + '?job_id=foo'
    )
    assert resp.status_code == 400


def test_filter_data_by_signature(
    client, test_repository, test_perf_signature, summary_perf_signature
):
    push = Push.objects.create(
        repository=test_repository, revision='abcdefghi', author='foo@bar.com', time=NOW
    )
    for (i, signature) in enumerate([test_perf_signature, summary_perf_signature]):
        PerformanceDatum.objects.create(
            repository=signature.repository,
            result_set_id=push.id,
            push=push,
            signature=signature,
            value=i,
            push_timestamp=NOW,
        )

    # test that we get the expected value for all different permutations of
    # passing in signature_id and signature hash
    for (i, signature) in enumerate([test_perf_signature, summary_perf_signature]):
        for (param, value) in [
            ('signatures', signature.signature_hash),
            ('signature_id', signature.id),
        ]:
            resp = client.get(
                reverse('performance-data-list', kwargs={"project": test_repository.name})
                + '?{}={}'.format(param, value)
            )
            assert resp.status_code == 200
            assert len(resp.data.keys()) == 1
            assert len(resp.data[signature.signature_hash]) == 1
            assert resp.data[signature.signature_hash][0]['signature_id'] == signature.id
            assert resp.data[signature.signature_hash][0]['value'] == float(i)


def test_perf_summary(client, test_perf_signature, test_perf_data):

    query_params1 = '?repository={}&framework={}&interval=172800&no_subtests=true&revision={}'.format(
        test_perf_signature.repository.name,
        test_perf_signature.framework_id,
        test_perf_data[0].push.revision,
    )

    query_params2 = '?repository={}&framework={}&interval=172800&no_subtests=true&startday=2013-11-01T23%3A28%3A29&endday=2013-11-30T23%3A28%3A29'.format(
        test_perf_signature.repository.name, test_perf_signature.framework_id
    )

    expected = [
        {
            'signature_id': test_perf_signature.id,
            'framework_id': test_perf_signature.framework_id,
            'signature_hash': test_perf_signature.signature_hash,
            'platform': test_perf_signature.platform.platform,
            'test': test_perf_signature.test,
            'application': test_perf_signature.application,
            'lower_is_better': test_perf_signature.lower_is_better,
            'has_subtests': test_perf_signature.has_subtests,
            'tags': test_perf_signature.tags,
            'measurement_unit': test_perf_signature.measurement_unit,
            'values': [test_perf_data[0].value],
            'name': 'mysuite mytest opt e10s opt',
            'parent_signature': None,
            'job_ids': [test_perf_data[0].job_id],
            'suite': test_perf_signature.suite,
            'repository_name': test_perf_signature.repository.name,
            'repository_id': test_perf_signature.repository.id,
            'data': [],
        }
    ]

    resp1 = client.get(reverse('performance-summary') + query_params1)
    assert resp1.status_code == 200
    assert resp1.json() == expected

    expected[0]['values'] = [item.value for item in test_perf_data]
    expected[0]['job_ids'] = [item.job_id for item in test_perf_data]
    resp2 = client.get(reverse('performance-summary') + query_params2)
    assert resp2.status_code == 200
    assert resp2.json() == expected
