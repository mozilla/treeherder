import copy
import pytest
import datetime
from django.urls import reverse
from collections import defaultdict

from tests.conftest import create_perf_alert
from treeherder.model.models import MachinePlatform, Push
from treeherder.webapp.api.performance_data import PerformanceSummary
from treeherder.perf.models import (
    PerformanceAlert,
    PerformanceDatum,
    PerformanceFramework,
    PerformanceSignature,
)

NOW = datetime.datetime.now()
ONE_DAY_AGO = NOW - datetime.timedelta(days=1)
THREE_DAYS_AGO = NOW - datetime.timedelta(days=3)
SEVEN_DAYS_AGO = NOW - datetime.timedelta(days=7)


@pytest.fixture
def summary_perf_signature(test_perf_signature):
    # summary performance signature don't have test value
    signature = PerformanceSignature.objects.create(
        repository=test_perf_signature.repository,
        signature_hash=(40 * "s"),
        framework=test_perf_signature.framework,
        platform=test_perf_signature.platform,
        option_collection=test_perf_signature.option_collection,
        suite="mysuite",
        test="",
        extra_options="e10s shell",
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
    new_framework = PerformanceFramework.objects.create(name="test_talos_2", enabled=True)
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
        reverse("performance-signatures-list", kwargs={"project": test_repository.name})
    )
    assert resp.status_code == 200
    assert resp.json() == {
        str(test_perf_signature.id): {
            "id": test_perf_signature.id,
            "signature_hash": test_perf_signature.signature_hash,
            "test": test_perf_signature.test,
            "application": test_perf_signature.application,
            "suite": test_perf_signature.suite,
            "tags": test_perf_signature.tags.split(" "),
            "option_collection_hash": test_perf_signature.option_collection.option_collection_hash,
            "framework_id": test_perf_signature.framework.id,
            "machine_platform": test_perf_signature.platform.platform,
            "extra_options": test_perf_signature.extra_options.split(" "),
            "measurement_unit": test_perf_signature.measurement_unit,
            "should_alert": test_perf_signature.should_alert,
        }
    }


def test_performance_platforms(client, test_perf_signature):
    resp = client.get(
        reverse(
            "performance-signatures-platforms-list",
            kwargs={"project": test_perf_signature.repository.name},
        )
    )
    assert resp.status_code == 200
    assert resp.json() == ["win7"]


def test_performance_platforms_expired_test(client, test_perf_signature):
    # check that we have no performance platform if the signatures are too old
    test_perf_signature.last_updated = datetime.datetime.utcfromtimestamp(0)
    test_perf_signature.save()
    resp = client.get(
        reverse(
            "performance-signatures-platforms-list",
            kwargs={"project": test_perf_signature.repository.name},
        )
        + f"?interval=86400"
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_performance_platforms_framework_filtering(client, test_perf_signature):
    # check framework filtering
    framework2 = PerformanceFramework.objects.create(name="test_talos2", enabled=True)
    platform2 = MachinePlatform.objects.create(os_name="win", platform="win7-a", architecture="x86")
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
            "performance-signatures-platforms-list",
            kwargs={"project": test_perf_signature.repository.name},
        )
    )
    assert resp.status_code == 200
    assert sorted(resp.json()) == ["win7", "win7-a"]

    # if we specify just one framework, should only return one
    resp = client.get(
        reverse(
            "performance-signatures-platforms-list",
            kwargs={"project": test_perf_signature.repository.name},
        )
        + f"?framework={framework2.id}"
    )
    assert resp.status_code == 200
    assert resp.json() == ["win7-a"]


def test_summary_performance_data(
    client, test_repository, summary_perf_signature, test_perf_signature
):
    summary_signature_id = summary_perf_signature.id
    resp = client.get(
        reverse("performance-signatures-list", kwargs={"project": test_repository.name})
    )
    assert resp.status_code == 200

    resp = client.get(
        reverse("performance-signatures-list", kwargs={"project": test_repository.name})
    )
    assert resp.status_code == 200

    assert len(resp.data.keys()) == 2
    assert set(resp.data.keys()) == {test_perf_signature.id, summary_signature_id}

    for signature in [summary_perf_signature, test_perf_signature]:
        expected = {
            "id": signature.id,
            "signature_hash": signature.signature_hash,
            "suite": signature.suite,
            "option_collection_hash": signature.option_collection.option_collection_hash,
            "framework_id": signature.framework_id,
            "machine_platform": signature.platform.platform,
            "should_alert": signature.should_alert,
        }
        if signature.test:
            expected["test"] = signature.test
        if signature.has_subtests:
            expected["has_subtests"] = True
        if signature.tags:
            # tags stored as charField but api returns as list
            expected["tags"] = signature.tags.split(" ")
        if signature.parent_signature:
            expected["parent_signature"] = signature.parent_signature.signature_hash
        if signature.extra_options:
            # extra_options stored as charField but api returns as list
            expected["extra_options"] = signature.extra_options.split(" ")
        if signature.measurement_unit:
            expected["measurement_unit"] = signature.measurement_unit
        if signature.application:
            expected["application"] = signature.application
        assert resp.data[signature.id] == expected


def test_filter_signatures_by_framework(
    client, test_repository, test_perf_signature, test_perf_signature_same_hash_different_framework
):
    signature2 = test_perf_signature_same_hash_different_framework

    # Filter by original framework
    resp = client.get(
        reverse("performance-signatures-list", kwargs={"project": test_repository.name})
        + "?framework=%s" % test_perf_signature.framework.id,
    )
    assert resp.status_code == 200
    assert len(resp.data.keys()) == 1
    assert resp.data[test_perf_signature.id]["framework_id"] == test_perf_signature.framework.id

    # Filter by new framework
    resp = client.get(
        reverse("performance-signatures-list", kwargs={"project": test_repository.name})
        + "?framework=%s" % signature2.framework.id,
    )
    assert resp.status_code == 200
    assert len(resp.data.keys()) == 1
    assert resp.data[signature2.id]["framework_id"] == signature2.framework.id


def test_filter_data_by_no_retriggers(
    client,
    test_repository,
    test_perf_signature,
    test_perf_signature_2,
    push_stored,
    test_perf_signature_same_hash_different_framework,
):
    push = Push.objects.get(id=1)
    push2 = Push.objects.get(id=2)

    signature_for_retrigger_data = test_perf_signature_same_hash_different_framework

    PerformanceDatum.objects.create(
        repository=test_perf_signature.repository,
        push=push,
        signature=test_perf_signature,
        value=0.0,
        push_timestamp=push.time,
    )

    PerformanceDatum.objects.create(
        repository=signature_for_retrigger_data.repository,
        push=push,
        signature=signature_for_retrigger_data,
        value=0.0,
        push_timestamp=push.time,
    )

    # new perf data where the signature has the same hash as the one's above,
    # but the perf data contains different push id
    test_perf_signature_2.signature_hash = test_perf_signature.signature_hash
    test_perf_signature_2.save()
    PerformanceDatum.objects.create(
        repository=test_perf_signature_2.repository,
        push=push2,
        signature=test_perf_signature_2,
        value=0.0,
        push_timestamp=push2.time,
    )

    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name})
        + f"?signatures={test_perf_signature.signature_hash}&no_retriggers=true"
    )
    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == 2
    assert set(datum["signature_id"] for datum in datums) == {
        test_perf_signature.id,
        test_perf_signature_2.id,
    }
    assert signature_for_retrigger_data.id not in set(datum["signature_id"] for datum in datums)


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
            signature=signature,
            value=0.0,
            push_timestamp=push.time,
        )

    # No filtering, return two datapoints (this behaviour actually sucks,
    # but it's "by design" for now, see bug 1265709)
    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name})
        + "?signatures="
        + test_perf_signature.signature_hash
    )
    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == 2
    assert set(datum["signature_id"] for datum in datums) == {1, 2}

    # Filtering by first framework
    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name})
        + "?signatures={}&framework={}".format(
            test_perf_signature.signature_hash, test_perf_signature.framework.id
        )
    )
    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == 1
    assert datums[0]["signature_id"] == 1

    # Filtering by second framework
    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name})
        + f"?signatures={test_perf_signature.signature_hash}&framework={signature2.framework.id}"
    )
    assert resp.status_code == 200
    datums = resp.data[test_perf_signature.signature_hash]
    assert len(datums) == 1
    assert datums[0]["signature_id"] == 2


def test_filter_signatures_by_interval(client, test_perf_signature):
    # interval for the last 24 hours, only one signature exists last updated within that timeframe
    resp = client.get(
        reverse(
            "performance-signatures-list", kwargs={"project": test_perf_signature.repository.name}
        )
        + f"?interval=86400"
    )
    assert resp.status_code == 200
    assert len(resp.json().keys()) == 1
    assert resp.json()[str(test_perf_signature.id)]["id"] == 1


@pytest.mark.parametrize(
    "start_date, end_date, exp_count, exp_id",
    [(SEVEN_DAYS_AGO, ONE_DAY_AGO, 1, 1), (THREE_DAYS_AGO, "", 1, 1), (ONE_DAY_AGO, "", 0, 0)],
)
def test_filter_signatures_by_range(
    client, test_perf_signature, start_date, end_date, exp_count, exp_id
):
    # set signature last updated to 3 days ago
    test_perf_signature.last_updated = THREE_DAYS_AGO
    test_perf_signature.save()

    resp = client.get(
        reverse(
            "performance-signatures-list", kwargs={"project": test_perf_signature.repository.name}
        )
        + f"?start_date={start_date}&end_date={end_date}"
    )
    assert resp.status_code == 200
    assert len(resp.json().keys()) == exp_count
    if exp_count != 0:
        assert resp.json()[str(test_perf_signature.id)]["id"] == exp_id


@pytest.mark.parametrize("interval, exp_push_ids", [(86400, {1}), (86400 * 3, {2, 1})])
def test_filter_data_by_interval(
    client, test_repository, test_perf_signature, interval, exp_push_ids
):
    # create some test data
    for i, timestamp in enumerate(
        [NOW, NOW - datetime.timedelta(days=2), NOW - datetime.timedelta(days=7)]
    ):
        push = Push.objects.create(
            repository=test_repository,
            revision="abcdefgh%s" % i,
            author="foo@bar.com",
            time=timestamp,
        )
        PerformanceDatum.objects.create(
            repository=test_perf_signature.repository,
            push=push,
            signature=test_perf_signature,
            value=i,
            push_timestamp=timestamp,
        )

    # going back interval of 1 day, should find 1 item
    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name})
        + f"?signature_id={test_perf_signature.id}&interval={interval}"
    )

    assert resp.status_code == 200

    perf_data = resp.data[test_perf_signature.signature_hash]
    push_ids = {datum["push_id"] for datum in perf_data}
    assert push_ids == exp_push_ids


@pytest.mark.parametrize(
    "start_date, end_date, exp_push_ids",
    [(SEVEN_DAYS_AGO, THREE_DAYS_AGO, {3}), (THREE_DAYS_AGO, "", {2, 1})],
)
def test_filter_data_by_range(
    client, test_repository, test_perf_signature, start_date, end_date, exp_push_ids
):
    # create some test data
    for i, timestamp in enumerate(
        [NOW, NOW - datetime.timedelta(days=2), NOW - datetime.timedelta(days=5)]
    ):
        push = Push.objects.create(
            repository=test_repository,
            revision="abcdefgh%s" % i,
            author="foo@bar.com",
            time=timestamp,
        )
        PerformanceDatum.objects.create(
            repository=test_perf_signature.repository,
            push=push,
            signature=test_perf_signature,
            value=i,
            push_timestamp=timestamp,
        )

    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name})
        + f"?signature_id={test_perf_signature.id}&start_date={start_date}&end_date={end_date}"
    )

    assert resp.status_code == 200

    perf_data = resp.data[test_perf_signature.signature_hash]
    push_ids = {datum["push_id"] for datum in perf_data}
    assert push_ids == exp_push_ids


def test_job_ids_validity(client, test_repository):
    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name}) + "?job_id=1"
    )
    assert resp.status_code == 200

    resp = client.get(
        reverse("performance-data-list", kwargs={"project": test_repository.name}) + "?job_id=foo"
    )
    assert resp.status_code == 400


def test_filter_data_by_signature(
    client, test_repository, test_perf_signature, summary_perf_signature
):
    push = Push.objects.create(
        repository=test_repository, revision="abcdefghi", author="foo@bar.com", time=NOW
    )
    for i, signature in enumerate([test_perf_signature, summary_perf_signature]):
        PerformanceDatum.objects.create(
            repository=signature.repository,
            push=push,
            signature=signature,
            value=i,
            push_timestamp=NOW,
        )

    # test that we get the expected value for all different permutations of
    # passing in signature_id and signature hash
    for i, signature in enumerate([test_perf_signature, summary_perf_signature]):
        for param, value in [
            ("signatures", signature.signature_hash),
            ("signature_id", signature.id),
        ]:
            resp = client.get(
                reverse("performance-data-list", kwargs={"project": test_repository.name})
                + f"?{param}={value}"
            )
            assert resp.status_code == 200
            assert len(resp.data.keys()) == 1
            assert len(resp.data[signature.signature_hash]) == 1
            assert resp.data[signature.signature_hash][0]["signature_id"] == signature.id
            assert resp.data[signature.signature_hash][0]["value"] == float(i)


def test_perf_summary(client, test_perf_signature, test_perf_data):
    query_params1 = (
        "?repository={}&framework={}&interval=172800&no_subtests=true&revision={}".format(
            test_perf_signature.repository.name,
            test_perf_signature.framework_id,
            test_perf_data[0].push.revision,
        )
    )

    query_params2 = "?repository={}&framework={}&interval=172800&no_subtests=true&startday=2013-11-01T23%3A28%3A29&endday=2013-11-30T23%3A28%3A29".format(
        test_perf_signature.repository.name, test_perf_signature.framework_id
    )

    expected = [
        {
            "signature_id": test_perf_signature.id,
            "framework_id": test_perf_signature.framework_id,
            "signature_hash": test_perf_signature.signature_hash,
            "platform": test_perf_signature.platform.platform,
            "test": test_perf_signature.test,
            "application": test_perf_signature.application,
            "lower_is_better": test_perf_signature.lower_is_better,
            "has_subtests": test_perf_signature.has_subtests,
            "tags": test_perf_signature.tags,
            "measurement_unit": test_perf_signature.measurement_unit,
            "values": [test_perf_data[0].value],
            "name": "mysuite mytest opt e10s opt",
            "parent_signature": None,
            "job_ids": [test_perf_data[0].job_id],
            "suite": test_perf_signature.suite,
            "repository_name": test_perf_signature.repository.name,
            "repository_id": test_perf_signature.repository.id,
            "data": [],
        }
    ]

    resp1 = client.get(reverse("performance-summary") + query_params1)
    assert resp1.status_code == 200
    assert resp1.json() == expected

    expected[0]["values"] = [item.value for item in test_perf_data]
    expected[0]["job_ids"] = [item.job_id for item in test_perf_data]
    resp2 = client.get(reverse("performance-summary") + query_params2)
    assert resp2.status_code == 200
    assert resp2.json() == expected


def test_data_points_from_same_push_are_ordered_chronologically(
    client, test_perf_signature, test_perf_data
):
    """
    The chronological order for data points associated to a single push
    is based upon the order of their related job. If related jobs are
    ordered, the data points are considered ordered.

    As job ids are auto incremented, older jobs have smaller ids than newer ones.
    Thus, these ids are sufficient to check for chronological order.
    """
    query_params = "?repository={}&framework={}&interval=172800&no_subtests=true&startday=2013-11-01T23%3A28%3A29&endday=2013-11-30T23%3A28%3A29".format(
        test_perf_signature.repository.name, test_perf_signature.framework_id
    )

    response = client.get(reverse("performance-summary") + query_params)
    assert response.status_code == 200

    job_ids = response.json()[0]["job_ids"]
    assert job_ids == sorted(job_ids)


def test_no_retriggers_perf_summary(
    client, push_stored, test_perf_signature, test_perf_signature_2, test_perf_data
):
    push = Push.objects.get(id=1)
    query_params = "?repository={}&framework={}&no_subtests=true&revision={}&all_data=true&signature={}".format(
        test_perf_signature.repository.name,
        test_perf_signature.framework_id,
        push.revision,
        test_perf_signature.id,
    )

    PerformanceDatum.objects.create(
        repository=test_perf_signature.repository,
        push=push,
        signature=test_perf_signature,
        value=0.0,
        push_timestamp=push.time,
    )

    PerformanceDatum.objects.create(
        repository=test_perf_signature_2.repository,
        push=push,
        signature=test_perf_signature_2,
        value=0.0,
        push_timestamp=push.time,
    )

    response = client.get(reverse("performance-summary") + query_params)
    content = response.json()
    assert response.status_code == 200
    assert len(content[0]["data"]) == 2

    response = client.get(reverse("performance-summary") + query_params + "&no_retriggers=true")
    content = response.json()
    assert response.status_code == 200
    assert len(content[0]["data"]) == 1


def test_filter_out_retriggers():
    input_data = [
        {
            "signature_id": 2247031,
            "framework_id": 1,
            "signature_hash": "d8a5c7f306f2f4e5f726adebeb075d560fd7a4af",
            "platform": "windows7-32-shippable",
            "test": "",
            "suite": "about_newtab_with_snippets",
            "lower_is_better": True,
            "has_subtests": True,
            "tags": "",
            "values": [],
            "name": "about_newtab_with_snippets opt e10s stylo",
            "parent_signature": None,
            "job_ids": [],
            "repository_name": "autoland",
            "repository_id": 77,
            "data": [
                {
                    "job_id": None,
                    "id": 1023332776,
                    "value": 90.49863386958299,
                    "push_timestamp": "2020-01-19T00:27:51",
                    "push_id": 629514,
                    "revision": "e9a3c8df0fc53e02d6fdd72f0a30e2fa88583077",
                },
                {
                    "job_id": None,
                    "id": 1023470518,
                    "value": 91.74966307216434,
                    "push_timestamp": "2020-01-19T16:00:58",
                    "push_id": 629559,
                    "revision": "045f16984963e58acb06bd7abf3af4f251feb898",
                },
                {
                    "job_id": None,
                    "id": 1023510351,
                    "value": 91.99462350050132,
                    "push_timestamp": "2020-01-19T18:23:40",
                    "push_id": 629559,
                    "revision": "1c9b97bed37830e39642bfa7e73dbc2ea860662a",
                },
                {
                    "job_id": None,
                    "id": 1023598611,
                    "value": 93.74967018412258,
                    "push_timestamp": "2020-01-19T22:19:05",
                    "push_id": 629559,
                    "revision": "bf297c03f0b7605ea3ea64320a3a4ce2b29f591f",
                },
                {
                    "job_id": None,
                    "id": 1023634055,
                    "value": 99.99504938362082,
                    "push_timestamp": "2020-01-20T01:42:32",
                    "push_id": 629630,
                    "revision": "f42dd5b1ffd6651e3ad2a2f218eb48c8a3a6825e",
                },
                {
                    "job_id": None,
                    "id": 1023692975,
                    "value": 89.99999999999997,
                    "push_timestamp": "2020-01-20T06:39:01",
                    "push_id": 629630,
                    "revision": "206cec28723abd20274126812c861e16f9f683d5",
                },
            ],
        }
    ]

    filtered_data = PerformanceSummary._filter_out_retriggers(copy.deepcopy(input_data))
    for perf_summary in filtered_data:
        push_id_count = defaultdict(int)
        for idx, datum in enumerate(perf_summary["data"]):
            push_id_count[datum["push_id"]] += 1
        for push_id in push_id_count:
            assert push_id_count[push_id] == 1

    assert len(filtered_data[0]["data"]) == 3

    no_retriggers_data = [
        {
            "signature_id": 2247031,
            "framework_id": 1,
            "signature_hash": "d8a5c7f306f2f4e5f726adebeb075d560fd7a4af",
            "platform": "windows7-32-shippable",
            "test": "",
            "suite": "about_newtab_with_snippets",
            "lower_is_better": True,
            "has_subtests": True,
            "tags": "",
            "values": [],
            "name": "about_newtab_with_snippets opt e10s stylo",
            "parent_signature": None,
            "job_ids": [],
            "repository_name": "autoland",
            "repository_id": 77,
            "data": [
                {
                    "job_id": None,
                    "id": 1023332776,
                    "value": 90.49863386958299,
                    "push_timestamp": "2020-01-19T00:27:51",
                    "push_id": 629514,
                    "revision": "e9a3c8df0fc53e02d6fdd72f0a30e2fa88583077",
                },
                {
                    "job_id": None,
                    "id": 1023692975,
                    "value": 89.99999999999997,
                    "push_timestamp": "2020-01-20T06:39:01",
                    "push_id": 629630,
                    "revision": "206cec28723abd20274126812c861e16f9f683d5",
                },
            ],
        }
    ]

    filtered_data = PerformanceSummary._filter_out_retriggers(copy.deepcopy(no_retriggers_data))
    assert filtered_data == no_retriggers_data


def test_alert_summary_tasks_get(client, test_perf_alert_summary, test_perf_data):
    create_perf_alert(
        summary=test_perf_alert_summary,
        series_signature=test_perf_data.first().signature,
        related_summary=test_perf_alert_summary,
        status=PerformanceAlert.REASSIGNED,
    )
    resp = client.get(
        reverse("performance-alertsummary-tasks") + f"?id={test_perf_alert_summary.id}"
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "id": test_perf_alert_summary.id,
        "tasks": [
            "B2G Emulator Image Build",
            "Inari Device Image Build",
            "Mochitest Browser Chrome",
            "Nexus 4 Device Image Build",
        ],
    }


def test_alert_summary_tasks_get_failure(client, test_perf_alert_summary):
    # verify that we fail if PerformanceAlertSummary does not exist
    not_exist_summary_id = test_perf_alert_summary.id
    test_perf_alert_summary.delete()
    resp = client.get(reverse("performance-alertsummary-tasks") + f"?id={not_exist_summary_id}")
    assert resp.status_code == 400
    assert resp.json() == {"message": ["PerformanceAlertSummary does not exist."]}

    # verify that we fail if id does not exist as a query parameter
    resp = client.get(reverse("performance-alertsummary-tasks"))
    assert resp.status_code == 400
    assert resp.json() == {"id": ["This field is required."]}
