from datetime import datetime
from unittest import mock

from django.urls import reverse
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST


class MockedCommitObject:
    def __init__(self):
        self.revision = "1ebfd5"


class MockedCommitSet:
    def __init__(self, basehash, newhash):
        self.newhash = newhash
        self.basehash = basehash

    def first(self):
        if self.basehash == "492424224" or self.newhash == "492424224":
            return None
        else:
            return MockedCommitObject()


def test_all_good(client):
    """
    test normal functionality
    """
    basehash = "494224"
    newhash = "4124814"
    newhashdate = datetime.now().strftime("%Y-%m-%d")
    basehashdate = datetime.now().strftime("%Y-%m-%d")
    with mock.patch(
        "treeherder.webapp.api.hash.Commit.objects.filter",
        return_value=MockedCommitSet(basehash, newhash),
    ):
        resp = client.get(
            reverse("hash-tocommit", kwargs={"project": "try"}),
            {
                "basehash": basehash,
                "newhash": newhash,
                "newhashdate": newhashdate,
                "basehashdate": basehashdate,
            },
        )
    assert resp.status_code == HTTP_200_OK
    assert resp.json() == {"baseRevision": "1ebfd5", "newRevision": "1ebfd5"}


def test_no_newhash_commit_returned(client):
    """
    test when no newhash is not found as a string in any commit we get the expected failure
    """
    basehash = "492424224"
    newhash = "412894814"
    newhashdate = datetime.now().strftime("%Y-%m-%d")
    basehashdate = datetime.now().strftime("%Y-%m-%d")
    with mock.patch(
        "treeherder.webapp.api.hash.Commit.objects.filter",
        return_value=MockedCommitSet(basehash, newhash),
    ):
        resp = client.get(
            reverse("hash-tocommit", kwargs={"project": "try"}),
            {
                "basehash": basehash,
                "newhash": newhash,
                "basehashdate": basehashdate,
                "newhashdate": newhashdate,
            },
        )
    assert resp.status_code == HTTP_400_BAD_REQUEST
    assert resp.json() == [
        f"The date and hash combination you provided({newhashdate} and {newhash}) is invalid"
    ]


def test_no_basehash_commit_returned(client):
    """
    test when no basehash is not found as a string in any commit we get the expected failure
    """
    basehash = "492424224"
    newhash = "412894814"
    newhashdate = datetime.now().strftime("%Y-%m-%d")
    basehashdate = datetime.now().strftime("%Y-%m-%d")
    with mock.patch(
        "treeherder.webapp.api.hash.Commit.objects.filter",
        return_value=MockedCommitSet(basehash, newhash),
    ):
        resp = client.get(
            reverse("hash-tocommit", kwargs={"project": "try"}),
            {
                "basehash": basehash,
                "newhash": newhash,
                "basehashdate": basehashdate,
                "newhashdate": newhashdate,
            },
        )
    assert resp.status_code == HTTP_400_BAD_REQUEST
    assert resp.json() == [
        f"The date and hash combination you provided({basehashdate} and {basehash}) is invalid"
    ]


def test_invalid_newhashdate_parameter(client):
    """
    test when no basehash is not found as a string in any commit we get the expected failure
    """
    basehash = "412894814"
    newhash = "492424224"
    newhashdate = "Bad date - Sallah"
    basehashdate = datetime.now().strftime("%Y-%m-%d")
    with mock.patch(
        "treeherder.webapp.api.hash.Commit.objects.filter",
        return_value=MockedCommitSet(basehash, newhash),
    ):
        resp = client.get(
            reverse("hash-tocommit", kwargs={"project": "try"}),
            {
                "basehash": basehash,
                "newhash": newhash,
                "basehashdate": basehashdate,
                "newhashdate": newhashdate,
            },
        )
    assert resp.status_code == HTTP_400_BAD_REQUEST
    assert resp.json() == {
        "newhashdate": [
            "Date has wrong format. Use one of these formats instead: YYYY-MM-DD."
        ]
    }


def test_invalid_basehashdate_parameter(client):
    """
    test when no basehash is not found as a string in any commit we get the expected failure
    """
    basehash = "412894814"
    newhash = "492424224"
    newhashdate = datetime.now().strftime("%Y-%m-%d")
    basehashdate = "Bad date - Sallah"
    with mock.patch(
        "treeherder.webapp.api.hash.Commit.objects.filter",
        return_value=MockedCommitSet(basehash, newhash),
    ):
        resp = client.get(
            reverse("hash-tocommit", kwargs={"project": "try"}),
            {
                "basehash": basehash,
                "newhash": newhash,
                "basehashdate": basehashdate,
                "newhashdate": newhashdate,
            },
        )
    assert resp.status_code == HTTP_400_BAD_REQUEST
    assert resp.json() == {
        "basehashdate": [
            "Date has wrong format. Use one of these formats instead: YYYY-MM-DD."
        ]
    }


def test_invalid_newhash_parameter(client):
    """
    test that when we provide a newhash it is numeric
    """
    basehash = "124898925481"
    newhash = "Invalid"
    newhashdate = datetime.now().strftime("%Y-%m-%d")
    basehashdate = datetime.now().strftime("%Y-%m-%d")
    resp = client.get(
        reverse("hash-tocommit", kwargs={"project": "try"}),
        {
            "basehash": basehash,
            "newhash": newhash,
            "basehashdate": basehashdate,
            "newhashdate": newhashdate,
        },
    )
    assert resp.status_code == HTTP_400_BAD_REQUEST
    assert resp.json() == {"newhash": ["A valid integer is required."]}


def test_invalid_basehash_parameter(client):
    """
    test that when we provide a basehash it is numeric
    """
    basehash = "Invalid"
    newhash = "124898925481"
    newhashdate = datetime.now().strftime("%Y-%m-%d")
    basehashdate = datetime.now().strftime("%Y-%m-%d")
    resp = client.get(
        reverse("hash-tocommit", kwargs={"project": "try"}),
        {
            "basehash": basehash,
            "newhash": newhash,
            "basehashdate": basehashdate,
            "newhashdate": newhashdate,
        },
    )
    assert resp.status_code == 400
    assert resp.json() == {"basehash": ["A valid integer is required."]}
