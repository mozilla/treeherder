from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from tests.autoclassify.utils import (create_failure_lines,
                                      test_line)
from treeherder.model.models import ClassifiedFailure


def test_get_classified_failure(webapp, classified_failures):
    """
    test getting a single failure line
    """
    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = webapp.get(
        reverse("classified-failure-detail", kwargs={"pk": classified_failures[0].id}))

    assert resp.status_int == 200
    actual = resp.json
    expected = {"id": classified_failures[0].id,
                "bug_number": 1234,
                "bug": None}

    assert actual == expected


def test_get_classified_failures(webapp, classified_failures):
    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = webapp.get(reverse("classified-failure-list"))
    assert resp.status_int == 200

    actual = resp.json
    expected = {"next": None,
                "previous": None,
                "results": [{"id": cf.id,
                             "bug_number": cf.bug_number,
                             "bug": None} for cf in reversed(classified_failures)]}
    assert actual == expected


def test_get_classified_failures_bug(webapp, classified_failures):
    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = webapp.get(reverse("classified-failure-list") + "?bug_number=1234")
    assert resp.status_int == 200

    actual = resp.json
    expected = {"next": None,
                "previous": None,
                "results": [{"id": classified_failures[0].id,
                             "bug_number": classified_failures[0].bug_number,
                             "bug": None}]}
    assert actual == expected


def test_post_new_classified_failure(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.post(reverse("classified-failure-list"),
                       {"bug_number": 5678}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[-1].id + 1,
                "bug_number": 5678,
                "bug": None}
    assert actual == expected

    obj = ClassifiedFailure.objects.get(id=actual["id"])
    assert obj.bug_number == 5678


def test_post_multiple(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.post(reverse("classified-failure-list"),
                       [{"bug_number": 5678}, {"bug_number": 9012}], format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = [{"id": classified_failures[-1].id + 1,
                 "bug_number": 5678,
                 "bug": None},
                {"id": classified_failures[-1].id + 2,
                 "bug_number": 9012,
                 "bug": None}]
    assert actual == expected

    for idx in range(0, 2):
        obj = ClassifiedFailure.objects.get(id=actual[idx]["id"])
        assert obj.bug_number == [5678, 9012][idx]


def test_post_repeated_classified_failure(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.post(reverse("classified-failure-list"),
                       {"bug_number": 1234}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[0].id,
                "bug_number": 1234,
                "bug": None}
    assert actual == expected


def test_put_new_bug_number(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.put(reverse("classified-failure-detail",
                              kwargs={"pk": classified_failures[0].id}),
                      {"bug_number": 5678}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[0].id,
                "bug_number": 5678,
                "bug": None}
    assert actual == expected

    classified_failures[0].refresh_from_db()
    assert classified_failures[0].bug_number == 5678


def test_put_existing_bug_number(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.put(reverse("classified-failure-detail",
                              kwargs={"pk": classified_failures[0].id}),
                      {"bug_number": 1234}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[0].id,
                "bug_number": 1234,
                "bug": None}
    assert actual == expected

    classified_failures[0].refresh_from_db()
    assert classified_failures[0].bug_number == 1234


def test_put_duplicate_bug_number(webapp, classified_failures, failure_lines):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    old_len = len(classified_failures)

    resp = client.put(reverse("classified-failure-detail",
                              kwargs={"pk": classified_failures[1].id}),
                      {"bug_number": 1234}, format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = {"id": classified_failures[0].id,
                "bug_number": 1234,
                "bug": None}
    assert actual == expected

    classified_failures = ClassifiedFailure.objects.all()
    assert len(classified_failures) == old_len - 1


def test_get_with_bug(webapp, classified_failures, bugs):
    """
    test getting a single failure line
    """
    bug = bugs[0]
    classified_failures[0].bug_number = bug.id
    classified_failures[0].save()

    resp = webapp.get(
        reverse("classified-failure-detail", kwargs={"pk": classified_failures[0].id}))

    assert resp.status_int == 200
    actual = resp.json
    expected = {"id": classified_failures[0].id,
                "bug_number": bug.id,
                "bug": {"status": bug.status,
                        "id": bug.id,
                        "summary": bug.summary,
                        "crash_signature": bug.crash_signature,
                        "keywords": bug.keywords,
                        "resolution": bug.resolution,
                        "os": bug.os,
                        "modified": bug.modified.isoformat()}}

    assert actual == expected


def test_put_multiple(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.put(reverse("classified-failure-list"),
                      [{"id": classified_failures[0].id, "bug_number": 5678},
                       {"id": classified_failures[1].id, "bug_number": 9012}],
                      format="json")

    assert resp.status_code == 200

    actual = resp.data
    expected = [{"id": classified_failures[0].id,
                 "bug_number": 5678,
                 "bug": None},
                {"id": classified_failures[1].id,
                 "bug_number": 9012,
                 "bug": None}]
    assert actual == expected

    classified_failures[0].refresh_from_db()
    assert classified_failures[0].bug_number == 5678
    classified_failures[1].refresh_from_db()
    assert classified_failures[1].bug_number == 9012


def test_put_multiple_repeat(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[0].save()

    resp = client.put(reverse("classified-failure-list"),
                      [{"id": classified_failures[0].id, "bug_number": 1234},
                       {"id": classified_failures[1].id, "bug_number": 5678}],
                      format="json")

    assert resp.status_code == 200

    actual = resp.data
    assert len(actual) == 2
    expected = [{"id": classified_failures[0].id,
                 "bug_number": 1234,
                 "bug": None},
                {"id": classified_failures[1].id,
                 "bug_number": 5678,
                 "bug": None}]
    assert actual == expected

    classified_failures[0].refresh_from_db()
    assert classified_failures[0].bug_number == 1234
    classified_failures[1].refresh_from_db()
    assert classified_failures[1].bug_number == 5678


def test_put_multiple_duplicate(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    new = ClassifiedFailure(bug_number=1234)
    new.save()
    classified_failures.append(new)

    resp = client.put(reverse("classified-failure-list"),
                      [{"id": classified_failures[0].id, "bug_number": 1234},
                       {"id": classified_failures[1].id, "bug_number": 5678}],
                      format="json")

    actual = resp.data
    assert len(actual) == 2
    expected = [{"id": classified_failures[2].id,
                 "bug_number": 1234,
                 "bug": None},
                {"id": classified_failures[1].id,
                 "bug_number": 5678,
                 "bug": None}]
    assert actual == expected

    new_classified_failures = ClassifiedFailure.objects.all()
    assert len(new_classified_failures) == len(classified_failures) - 1


def test_put_multiple_duplicate_1(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    new = ClassifiedFailure(bug_number=1234)
    new.save()
    classified_failures.append(new)

    resp = client.put(reverse("classified-failure-list"),
                      [{"id": classified_failures[0].id, "bug_number": 1234},
                       {"id": classified_failures[1].id, "bug_number": 1234}],
                      format="json")

    actual = resp.data
    assert len(actual) == 2
    expected = [{"id": classified_failures[2].id,
                 "bug_number": 1234,
                 "bug": None},
                {"id": classified_failures[2].id,
                 "bug_number": 1234,
                 "bug": None}]
    assert actual == expected

    new_classified_failures = ClassifiedFailure.objects.all()
    assert len(new_classified_failures) == len(classified_failures) - 2


def test_put_multiple_duplicate_2(webapp, classified_failures):
    client = APIClient()
    user = User.objects.create(username="MyName")
    client.force_authenticate(user=user)

    classified_failures[0].bug_number = 1234
    classified_failures[1].bug_number = 5678
    for item in classified_failures:
        item.save()

    resp = client.put(reverse("classified-failure-list"),
                      [{"id": classified_failures[0].id, "bug_number": 5678},
                       {"id": classified_failures[1].id, "bug_number": 1234}],
                      format="json")

    assert resp.status_code == 400


def test_get_matching_lines(webapp, test_repository, failure_lines, classified_failures):
    """
    test getting a single failure line
    """

    for failure_line in failure_lines:
        failure_line.best_classification = classified_failures[0]
        failure_line.save()

    extra_lines = create_failure_lines(test_repository,
                                       failure_lines[0].job_guid,
                                       [(test_line, {"test": "test2", "line": 2}),
                                        (test_line, {"test": "test2", "subtest": "subtest2",
                                                     "line": 3})])

    extra_lines[1].best_classification = classified_failures[1]
    extra_lines[1].save()

    resp = webapp.get(
        reverse("classified-failure-matches", kwargs={"pk": classified_failures[0].id}))

    assert resp.status_int == 200
    actual = resp.json["results"]

    assert [item["id"] for item in actual] == [item.id for item in reversed(failure_lines)]
