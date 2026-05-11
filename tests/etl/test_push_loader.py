import copy
import datetime
import json
import os
import types

import pytest
import responses

from treeherder.etl.push_loader import (
    GithubPullRequestTransformer,
    GithubPushTransformer,
    HgPushFetchError,
    HgPushTransformer,
    PulsePushError,
    PushLoader,
)
from treeherder.model.models import Push


@pytest.fixture
def github_push(sample_data):
    return copy.deepcopy(sample_data.github_push)


@pytest.fixture
def github_pr(sample_data):
    return copy.deepcopy(sample_data.github_pr)


@pytest.fixture
def hg_push(sample_data):
    return copy.deepcopy(sample_data.hg_push)


@pytest.fixture
def transformed_github_push(sample_data):
    return copy.deepcopy(sample_data.transformed_github_push)


@pytest.fixture
def transformed_github_pr(sample_data):
    return copy.deepcopy(sample_data.transformed_github_pr)


@pytest.fixture
def transformed_hg_push(sample_data):
    return copy.deepcopy(sample_data.transformed_hg_push)


def _make_commit_object(data):
    """Build a SimpleNamespace that mimics a PyGithub Commit object from raw JSON."""
    return types.SimpleNamespace(
        sha=data["sha"],
        commit=types.SimpleNamespace(
            author=types.SimpleNamespace(
                name=data["commit"]["author"]["name"],
                email=data["commit"]["author"]["email"],
            ),
            committer=types.SimpleNamespace(
                date=datetime.datetime.fromisoformat(data["commit"]["committer"]["date"]),
            ),
            message=data["commit"]["message"],
        ),
    )


@pytest.fixture
def mock_github_pr_commits(monkeypatch):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(tests_folder, "sample_data/pulse_consumer", "github_pr_commits.json")
    with open(path) as f:
        raw_commits = json.load(f)

    mock_commits = [_make_commit_object(c) for c in raw_commits]

    monkeypatch.setattr(
        "treeherder.etl.push_loader.get_pull_request_commits",
        lambda org, repo, pr_id: mock_commits,
    )


@pytest.fixture
def mock_github_push_compare(monkeypatch):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(tests_folder, "sample_data/pulse_consumer", "github_push_compare.json")
    with open(path) as f:
        mocked_content = json.load(f)

    # Build a lookup: (base_sha, head_sha) -> list of mock commit objects
    compare_map = {}
    for item in mocked_content:
        compare_part = item["url"].split("/compare/")[1]
        base, head = compare_part.split("...")
        compare_map[(base, head)] = [_make_commit_object(c) for c in item["commits"]]

    def mock_compare_shas(org, repo_name, base, head):
        return compare_map.get((base, head), [])

    monkeypatch.setattr(
        "treeherder.etl.push_loader.compare_shas",
        mock_compare_shas,
    )


@pytest.fixture
def mock_hg_push_commits(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(tests_folder, "sample_data/pulse_consumer", "hg_push_commits.json")
    with open(path) as f:
        mocked_content = f.read()
    responses.add(
        responses.GET,
        "https://hg.mozilla.org/try/json-pushes",
        body=mocked_content,
        status=200,
        content_type="application/json",
    )


@pytest.mark.parametrize(
    "exchange, transformer_class",
    [
        ("exchange/taskcluster-github/v1/push", GithubPushTransformer),
        ("exchange/taskcluster-github/v1/pull-request", GithubPullRequestTransformer),
    ],
)
def test_get_transformer_class(exchange, transformer_class):
    rsl = PushLoader()
    assert rsl.get_transformer_class(exchange) == transformer_class


def test_unsupported_exchange():
    with pytest.raises(PulsePushError):
        rsl = PushLoader()
        rsl.get_transformer_class("meh")


def test_ingest_github_pull_request(
    test_repository, github_pr, transformed_github_pr, mock_github_pr_commits
):
    xformer = GithubPullRequestTransformer(github_pr)
    push = xformer.transform(test_repository.name)
    assert transformed_github_pr == push


def test_ingest_github_push(
    test_repository, github_push, transformed_github_push, mock_github_push_compare
):
    xformer = GithubPushTransformer(github_push[0]["payload"])
    push = xformer.transform(test_repository.name)
    assert transformed_github_push == push


def test_ingest_hg_push(test_repository, hg_push, transformed_hg_push, mock_hg_push_commits):
    xformer = HgPushTransformer(hg_push)
    push = xformer.transform(test_repository.name)
    assert transformed_hg_push == push


@pytest.mark.django_db
def test_ingest_hg_push_good_repo(hg_push, test_repository, mock_hg_push_commits):
    """Test graceful handling of an unknown HG repo"""
    hg_push["payload"]["repo_url"] = "https://hg.mozilla.org/mozilla-central"
    assert Push.objects.count() == 0
    PushLoader().process(
        hg_push, "exchange/hgpushes/v1", "https://firefox-ci-tc.services.mozilla.com"
    )
    assert Push.objects.count() == 1


@pytest.mark.django_db
def test_ingest_hg_push_bad_repo(hg_push):
    """Test graceful handling of an unknown HG repo"""
    hg_push["payload"]["repo_url"] = "https://bad.repo.com"
    PushLoader().process(
        hg_push, "exchange/hgpushes/v1", "https://firefox-ci-tc.services.mozilla.com"
    )
    assert Push.objects.count() == 0


@pytest.mark.django_db
def test_ingest_github_push_bad_repo(github_push):
    """Test graceful handling of an unknown GH repo"""
    github_push[0]["payload"]["details"]["event.head.repo.url"] = "https://bad.repo.com"
    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == 0


@pytest.mark.django_db
def test_ingest_github_push_merge_commit(github_push, test_repository, mock_github_push_compare):
    """Test a a merge push which will require hitting the network for the right info"""
    test_repository.url = github_push[1]["payload"]["details"]["event.head.repo.url"].replace(
        ".git", ""
    )
    test_repository.branch = github_push[1]["payload"]["details"]["event.base.repo.branch"]
    test_repository.save()
    PushLoader().process(
        github_push[1]["payload"],
        github_push[1]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "branch, expected_pushes",
    [
        ("master", 1),
        ("bar", 1),
        ("baz", 0),
        ("foo", 1),
    ],
)
def test_ingest_github_push_comma_separated_branches(
    branch, expected_pushes, github_push, test_repository, mock_github_push_compare
):
    """Test a repository accepting pushes for multiple branches"""
    test_repository.url = github_push[0]["payload"]["details"]["event.head.repo.url"].replace(
        ".git", ""
    )
    test_repository.branch = "master,foo,bar"
    test_repository.save()
    github_push[0]["payload"]["details"]["event.base.repo.branch"] = branch
    assert Push.objects.count() == 0
    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == expected_pushes


def test_fetch_push_raises_on_empty_pushes(monkeypatch):
    """Test that a HgPushFetchError is raised when fetch_json returns a dict without 'pushes'"""
    monkeypatch.setattr("treeherder.etl.push_loader.fetch_json", lambda url: {})
    transformer = HgPushTransformer(
        {
            "payload": {
                "repo_url": "https://hg.mozilla.org/try",
                "pushlog_pushes": [{"push_full_json_url": "http://example"}],
            }
        }
    )
    with pytest.raises(HgPushFetchError):
        transformer.fetch_push("http://example", repository="try")
