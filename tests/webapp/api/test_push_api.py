import datetime

import pytest
from django.urls import reverse

from tests.conftest import IS_WINDOWS
from treeherder.etl.push import store_push_data
from treeherder.model.models import Commit, FailureClassification, JobNote, Push
from treeherder.webapp.api import utils


def test_push_list_basic(client, eleven_jobs_stored, test_repository):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = client.get(reverse("push-list", kwargs={"project": test_repository.name}))
    data = resp.json()
    results = data["results"]
    meta = data["meta"]

    assert resp.status_code == 200
    assert isinstance(results, list)

    assert len(results) == 10
    exp_keys = set(
        [
            "id",
            "repository_id",
            "author",
            "revision",
            "revisions",
            "revision_count",
            "push_timestamp",
        ]
    )
    for rs in results:
        assert set(rs.keys()) == exp_keys

    assert meta == {"count": 10, "filter_params": {}, "repository": test_repository.name}


def test_push_list_bad_project(client, transactional_db):
    """
    test that we have a sane error when the repository does not exist
    """
    resp = client.get(
        reverse("push-list", kwargs={"project": "foo"}),
    )
    assert resp.status_code == 404
    assert resp.json() == {"detail": "No project with name foo"}


def test_push_list_empty_push_still_show(client, sample_push, test_repository):
    """
    test retrieving a push list, when the push has no jobs.
    should show.
    """
    store_push_data(test_repository, sample_push)

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 10


def test_push_list_single_short_revision(client, eleven_jobs_stored, test_repository):
    """
    test retrieving a push list, filtered by single short revision
    """

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}), {"revision": "45f8637cb9f7"}
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    meta = resp.json()["meta"]
    assert len(results) == 1
    assert set([rs["revision"] for rs in results]) == {"45f8637cb9f78f19cb8463ff174e81756805d8cf"}
    assert meta == {
        "count": 1,
        "revision": "45f8637cb9f7",
        "filter_params": {"revisions_short_revision": "45f8637cb9f7"},
        "repository": test_repository.name,
    }


def test_push_list_single_long_revision(client, eleven_jobs_stored, test_repository):
    """
    test retrieving a push list, filtered by a single long revision
    """

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}),
        {"revision": "45f8637cb9f78f19cb8463ff174e81756805d8cf"},
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    meta = resp.json()["meta"]
    assert len(results) == 1
    assert set([rs["revision"] for rs in results]) == {"45f8637cb9f78f19cb8463ff174e81756805d8cf"}
    assert meta == {
        "count": 1,
        "revision": "45f8637cb9f78f19cb8463ff174e81756805d8cf",
        "filter_params": {"revisions_long_revision": "45f8637cb9f78f19cb8463ff174e81756805d8cf"},
        "repository": test_repository.name,
    }


@pytest.mark.skipif(IS_WINDOWS, reason="timezone mixup happening somewhere")
def test_push_list_filter_by_revision(client, eleven_jobs_stored, test_repository):
    """
    test retrieving a push list, filtered by a revision range
    """

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}),
        {"fromchange": "130965d3df6c", "tochange": "f361dcb60bbe"},
    )
    assert resp.status_code == 200
    data = resp.json()
    results = data["results"]
    meta = data["meta"]
    assert len(results) == 4
    assert set([rs["revision"] for rs in results]) == {
        "130965d3df6c9a1093b4725f3b877eaef80d72bc",
        "7f417c3505e3d2599ac9540f02e3dbee307a3963",
        "a69390334818373e2d7e6e9c8d626a328ed37d47",
        "f361dcb60bbedaa01257fbca211452972f7a74b2",
    }
    assert meta == {
        "count": 4,
        "fromchange": "130965d3df6c",
        "filter_params": {"push_timestamp__gte": 1384363842, "push_timestamp__lte": 1384365942},
        "repository": test_repository.name,
        "tochange": "f361dcb60bbe",
    }


@pytest.mark.skipif(IS_WINDOWS, reason="timezone mixup happening somewhere")
def test_push_list_filter_by_date(client, test_repository, sample_push):
    """
    test retrieving a push list, filtered by a date range
    """
    for i, datestr in zip(
        [3, 4, 5, 6, 7], ["2013-08-09", "2013-08-10", "2013-08-11", "2013-08-12", "2013-08-13"]
    ):
        sample_push[i]["push_timestamp"] = utils.to_timestamp(utils.to_datetime(datestr))

    store_push_data(test_repository, sample_push)

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}),
        {"startdate": "2013-08-10", "enddate": "2013-08-13"},
    )
    assert resp.status_code == 200
    data = resp.json()
    results = data["results"]
    meta = data["meta"]
    assert len(results) == 4
    assert set([rs["revision"] for rs in results]) == {
        "ce17cad5d554cfffddee13d1d8421ae9ec5aad82",
        "7f417c3505e3d2599ac9540f02e3dbee307a3963",
        "a69390334818373e2d7e6e9c8d626a328ed37d47",
        "f361dcb60bbedaa01257fbca211452972f7a74b2",
    }
    assert meta == {
        "count": 4,
        "enddate": "2013-08-13",
        "filter_params": {
            "push_timestamp__gte": 1376092800.0,
            "push_timestamp__lt": 1376438400.0,
        },
        "repository": test_repository.name,
        "startdate": "2013-08-10",
    }


@pytest.mark.parametrize(
    "filter_param, exp_ids",
    [
        ("id__lt=2", [1]),
        ("id__lte=2", [1, 2]),
        ("id=2", [2]),
        ("id__gt=2", [3]),
        ("id__gte=2", [2, 3]),
    ],
)
def test_push_list_filter_by_id(client, test_repository, filter_param, exp_ids):
    """
    test filtering by id in various ways
    """
    for revision, author in [
        ("1234abcd", "foo@bar.com"),
        ("2234abcd", "foo2@bar.com"),
        ("3234abcd", "foo3@bar.com"),
    ]:
        Push.objects.create(
            repository=test_repository,
            revision=revision,
            author=author,
            time=datetime.datetime.now(),
        )
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?" + filter_param
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert set([result["id"] for result in results]) == set(exp_ids)


def test_push_list_id_in(client, test_repository):
    """
    test the id__in parameter
    """
    for revision, author in [
        ("1234abcd", "foo@bar.com"),
        ("2234abcd", "foo2@bar.com"),
        ("3234abcd", "foo3@bar.com"),
    ]:
        Push.objects.create(
            repository=test_repository,
            revision=revision,
            author=author,
            time=datetime.datetime.now(),
        )
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?id__in=1,2"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2  # would have 3 if filter not applied
    assert set([result["id"] for result in results]) == set([1, 2])

    # test that we do something sane if invalid list passed in
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?id__in=1,2,foobar",
    )
    assert resp.status_code == 400


def test_push_list_bad_count(client, test_repository):
    """
    test for graceful error when passed an invalid count value
    """
    bad_count = "ZAP%n%s%n%s"

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}), data={"count": bad_count}
    )

    assert resp.status_code == 400
    assert resp.json() == {"detail": "Valid count value required"}


def test_push_list_negative_count(client, test_repository):
    """
    test for graceful error when passed an invalid count value
    """
    bad_count = -1

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}), data={"count": bad_count}
    )

    assert resp.status_code == 400
    assert resp.json() == {"detail": f"count requires a positive integer, not: {bad_count}"}


def test_push_author(client, test_repository):
    """
    test the author parameter
    """
    for revision, author in [
        ("1234abcd", "foo@bar.com"),
        ("2234abcd", "foo@bar.com"),
        ("3234abcd", "foo2@bar.com"),
    ]:
        Push.objects.create(
            repository=test_repository,
            revision=revision,
            author=author,
            time=datetime.datetime.now(),
        )

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author=foo@bar.com"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2  # would have 3 if filter not applied
    assert set([result["id"] for result in results]) == set([1, 2])

    # iexact looks for a case-insensitive match
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author=FoO@bar.com"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2  # would have 3 if filter not applied
    assert set([result["id"] for result in results]) == set([1, 2])

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author=foo2@bar.com"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 1  # would have 3 if filter not applied
    assert results[0]["id"] == 3

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author=-foo2@bar.com"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2  # would have 3 if filter not applied
    assert set([result["id"] for result in results]) == set([1, 2])

    # iexact looks for a case-insensitive match
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author=-FOo2@bar.com"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2  # would have 3 if filter not applied
    assert set([result["id"] for result in results]) == set([1, 2])


def test_push_author_contains(client, test_repository):
    """
    test the author parameter
    """
    for revision, author in [
        ("1234abcd", "foo@bar.com"),
        ("2234abcd", "foo2@bar.com"),
        ("3234abcd", "qux@bar.com"),
    ]:
        Push.objects.create(
            repository=test_repository,
            revision=revision,
            author=author,
            time=datetime.datetime.now(),
        )

    # icontains - case-insensitive containment test
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author_contains=fOo"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2
    assert set([result["id"] for result in results]) == set([1, 2])

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author_contains=foO2"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == 2

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?author_contains=qux"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == 3


def test_push_search(client, test_repository):
    """
    Test the search parameter for filtering by Commit fields: revision, author, comments.
    """
    now = datetime.datetime.now()
    push1 = Push.objects.create(
        repository=test_repository,
        revision="1234abcd",
        author="foo@bar.com",
        time=now,
    )
    push2 = Push.objects.create(
        repository=test_repository,
        revision="2234abcd",
        author="foo2@bar.com",
        time=now + datetime.timedelta(seconds=1),
    )
    push3 = Push.objects.create(
        repository=test_repository,
        revision="3234abcd",
        author="qux@bar.com",
        time=now + datetime.timedelta(seconds=2),
    )

    # Add Commit objects linked to the Push objects
    Commit.objects.create(
        push=push1, revision="1234abcd", author="kaz <foo@bar.com>", comments="Initial commit"
    )
    Commit.objects.create(
        push=push2, revision="2234abcd", author="foo <foo2@bar.com>", comments="Bug 12345567 - fix"
    )
    Commit.objects.create(
        push=push3,
        revision="3234abcd",
        author="quxzan <qux@bar>.com",
        comments="Bug 12345567 - Feature added",
    )

    # Test search by comments
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?search=bug"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2
    assert set([result["id"] for result in results]) == set([3, 2])

    # Test search by bug number
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?search=12345567"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2
    assert set([result["id"] for result in results]) == set([3, 2])

    # Test search by author
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?search=foo"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == push2.id

    # Test search by revision
    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name}) + "?search=3234abcd"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == push3.id

    # Test empty search input
    resp = client.get(reverse("push-list", kwargs={"project": test_repository.name}) + "?search=")
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 3
    assert set([result["id"] for result in results]) == set([3, 2, 1])


def test_push_reviewbot(client, test_repository):
    """
    test the reviewbot parameter
    """
    for revision, author in [
        ("1234abcd", "foo@bar.com"),
        ("2234abcd", "foo2@bar.com"),
        ("3234abcd", "reviewbot"),
        ("4234abcd", "reviewbot"),
    ]:
        Push.objects.create(
            repository=test_repository,
            revision=revision,
            author=author,
            time=datetime.datetime.now(),
        )

    resp = client.get(
        reverse("push-list", kwargs={"project": test_repository.name})
        + "?hide_reviewbot_pushes=true"
    )
    assert resp.status_code == 200

    results = resp.json()["results"]
    assert len(results) == 2
    assert set([result["id"] for result in results]) == set([1, 2])


def test_push_list_without_jobs(client, test_repository, sample_push):
    """
    test retrieving a push list without jobs
    """
    store_push_data(test_repository, sample_push)

    resp = client.get(reverse("push-list", kwargs={"project": test_repository.name}))
    assert resp.status_code == 200
    data = resp.json()
    results = data["results"]
    assert len(results) == 10
    assert all([("platforms" not in result) for result in results])

    meta = data["meta"]

    assert meta == {
        "count": len(results),
        "filter_params": {},
        "repository": test_repository.name,
    }


def test_push_detail(client, eleven_jobs_stored, test_repository):
    """
    test retrieving a push from the push-detail
    endpoint.
    """

    push = Push.objects.get(id=1)

    resp = client.get(reverse("push-detail", kwargs={"project": test_repository.name, "pk": 1}))
    assert resp.status_code == 200
    assert isinstance(resp.json(), dict)
    assert resp.json()["id"] == push.id


def test_push_detail_not_found(client, test_repository):
    """
    test retrieving a HTTP 404 from the push-detail
    endpoint.
    """
    resp = client.get(
        reverse("push-detail", kwargs={"project": test_repository.name, "pk": -32767}),
    )
    assert resp.status_code == 404


def test_push_detail_bad_project(client, test_repository):
    """
    test retrieving a HTTP 404 from the push-detail
    endpoint.
    """
    bad_pk = -32767
    resp = client.get(
        reverse("push-detail", kwargs={"project": "foo", "pk": bad_pk}),
    )
    assert resp.status_code == 404


def test_push_status(client, test_job, test_user):
    """
    test retrieving the status of a push
    """
    failure_classification = FailureClassification.objects.get(name="fixed by commit")

    push = test_job.push

    resp = client.get(
        reverse("push-status", kwargs={"project": push.repository.name, "pk": push.id})
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), dict)
    assert resp.json() == {"success": 1, "completed": 1, "pending": 0, "running": 0}

    JobNote.objects.create(
        job=test_job,
        failure_classification=failure_classification,
        user=test_user,
        text="A random note",
    )

    resp = client.get(
        reverse("push-status", kwargs={"project": push.repository.name, "pk": push.id})
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), dict)
    assert resp.json() == {"completed": 0, "pending": 0, "running": 0}
