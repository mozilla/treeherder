import copy
import json
import os

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
from treeherder.model.models import Push, RepositoryBranch


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


@pytest.fixture
def mock_github_pr_commits(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder, "sample_data/pulse_consumer", "github_repository_test_treeherder.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(
        responses.GET,
        "https://api.github.com:443/repos/mozilla/test_treeherder",
        body=mocked_content,
        status=200,
        content_type="application/json",
    )

    path = os.path.join(
        tests_folder, "sample_data/pulse_consumer", "github_pr_test_treeherder_1692.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(
        responses.GET,
        "https://api.github.com:443/repos/mozilla/test_treeherder/pulls/1692",
        body=mocked_content,
        status=200,
        content_type="application/json",
    )

    path = os.path.join(tests_folder, "sample_data/pulse_consumer", "github_pr_commits.json")
    with open(path) as f:
        mocked_content = f.read()
    responses.add(
        responses.GET,
        "https://api.github.com:443/repos/mozilla/test_treeherder/pulls/1692/commits",
        body=mocked_content,
        status=200,
        content_type="application/json",
    )


@pytest.fixture
def mock_github_push_compare(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))

    path = os.path.join(
        tests_folder, "sample_data/pulse_consumer", "github_repository_android-components.json"
    )
    with open(path) as f:
        mocked_content = json.load(f)
    responses.add(
        responses.GET,
        "https://api.github.com:443/repos/mozilla-mobile/android-components",
        json=mocked_content,
        status=200,
        content_type="application/json",
    )

    path = os.path.join(tests_folder, "sample_data/pulse_consumer", "github_repository_servo.json")
    with open(path) as f:
        mocked_content = json.load(f)
    responses.add(
        responses.GET,
        "https://api.github.com:443/repos/servo/servo",
        json=mocked_content,
        status=200,
        content_type="application/json",
    )

    path = os.path.join(tests_folder, "sample_data/pulse_consumer", "github_push_compare.json")
    with open(path) as f:
        mocked_content = json.load(f)
    responses.add(
        responses.GET,
        "https://api.github.com:443/repos/mozilla-mobile/android-components/compare/"
        "7285afe57ae6207fdb5d6db45133dac2053b7820..."
        "5fdb785b28b356f50fc1d9cb180d401bb03fc1f1",
        json=mocked_content[0],
        status=200,
        content_type="application/json",
    )
    responses.add(
        responses.GET,
        "https://api.github.com:443/repos/servo/servo/compare/"
        "4c25e02f26f7536edbf23a360d56604fb9507378..."
        "ad9bfc2a62b70b9f3dbb1c3a5969f30bacce3d74",
        json=mocked_content[1],
        status=200,
        content_type="application/json",
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


def test_ingest_github_push_new_branch(github_push):
    """Webhook body commits are used when base SHA is all zeroes (new branch)."""
    github_push[0]["payload"]["details"]["event.base.sha"] = "0" * 40
    commits = github_push[0]["payload"]["body"]["commits"]

    xformer = GithubPushTransformer(github_push[0]["payload"])
    push = xformer.transform("some-repo")

    assert push["revision"] == commits[-1]["id"]
    assert len(push["revisions"]) == len(commits)


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
def test_ingest_hg_push_ignores_wildcard_repo(hg_push, test_repository, mock_hg_push_commits):
    """Repos with wildcard branches are not matched for Hg pushes"""
    from treeherder.model.models import Repository

    hg_push["payload"]["repo_url"] = test_repository.url
    wildcard_repo = Repository.objects.create(
        name="wildcard-hg",
        repository_group=test_repository.repository_group,
        dvcs_type="hg",
        url=test_repository.url,
        tc_root_url=test_repository.tc_root_url,
    )
    RepositoryBranch.objects.create(repository=wildcard_repo, branch="*")
    PushLoader().process(
        hg_push, "exchange/hgpushes/v1", "https://firefox-ci-tc.services.mozilla.com"
    )
    assert Push.objects.count() == 1
    assert Push.objects.first().repository == test_repository


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
    test_repository.save()
    RepositoryBranch.objects.create(
        repository=test_repository,
        branch=github_push[1]["payload"]["details"]["event.base.repo.branch"],
    )
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
    """Test a repository accepting pushes for multiple explicitly-listed branches"""
    test_repository.url = github_push[0]["payload"]["details"]["event.head.repo.url"].replace(
        ".git", ""
    )
    test_repository.save()
    for b in ["master", "foo", "bar"]:
        RepositoryBranch.objects.create(repository=test_repository, branch=b)
    github_push[0]["payload"]["details"]["event.base.repo.branch"] = branch
    assert Push.objects.count() == 0
    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == expected_pushes


@pytest.mark.django_db
def test_ingest_github_push_wildcard_repo(github_push, test_repository, mock_github_push_compare):
    """Repo with branch='*' accepts a push on any branch"""
    test_repository.url = github_push[0]["payload"]["details"]["event.head.repo.url"].replace(
        ".git", ""
    )
    test_repository.save()
    RepositoryBranch.objects.create(repository=test_repository, branch="*")
    github_push[0]["payload"]["details"]["event.base.repo.branch"] = "my-feature-branch"
    assert Push.objects.count() == 0
    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == 1


@pytest.mark.django_db
def test_ingest_github_push_explicit_beats_wildcard(
    github_push, test_repository, mock_github_push_compare
):
    """Explicit branch match takes precedence over wildcard for the same URL"""
    from treeherder.model.models import Repository

    url = github_push[0]["payload"]["details"]["event.head.repo.url"].replace(".git", "")
    branch = github_push[0]["payload"]["details"]["event.base.repo.branch"]

    test_repository.url = url
    test_repository.save()
    RepositoryBranch.objects.create(repository=test_repository, branch=branch)

    wildcard_repo = Repository.objects.create(
        name="wildcard-repo",
        repository_group=test_repository.repository_group,
        dvcs_type="git",
        url=url,
        tc_root_url=test_repository.tc_root_url,
    )
    RepositoryBranch.objects.create(repository=wildcard_repo, branch="*")

    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == 1
    push = Push.objects.first()
    assert push.repository == test_repository
    assert push.repository != wildcard_repo


@pytest.mark.django_db
def test_ingest_github_push_special_char_branch(
    github_push, test_repository, mock_github_push_compare
):
    """Branch names with special chars are handled safely via wildcard branch record"""
    test_repository.url = github_push[0]["payload"]["details"]["event.head.repo.url"].replace(
        ".git", ""
    )
    test_repository.save()
    RepositoryBranch.objects.create(repository=test_repository, branch="*")
    github_push[0]["payload"]["details"]["event.base.repo.branch"] = "release/v1.2+hotfix"
    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "branch, expected_pushes",
    [
        ("releases/v1.2", 1),
        ("master", 0),
    ],
)
def test_ingest_github_push_prefix_wildcard(
    branch, expected_pushes, github_push, test_repository, mock_github_push_compare
):
    """A prefix wildcard like 'releases/*' matches branches under that prefix only"""
    test_repository.url = github_push[0]["payload"]["details"]["event.head.repo.url"].replace(
        ".git", ""
    )
    test_repository.save()
    RepositoryBranch.objects.create(repository=test_repository, branch="releases/*")
    github_push[0]["payload"]["details"]["event.base.repo.branch"] = branch
    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == expected_pushes


@pytest.mark.django_db
def test_ingest_github_push_ambiguous_wildcards_skipped(
    github_push, test_repository, mock_github_push_compare
):
    """When two wildcard patterns both match, the push is skipped"""
    from treeherder.model.models import Repository

    url = github_push[0]["payload"]["details"]["event.head.repo.url"].replace(".git", "")
    test_repository.url = url
    test_repository.save()
    RepositoryBranch.objects.create(repository=test_repository, branch="releases/*")

    catchall_repo = Repository.objects.create(
        name="catchall-repo",
        repository_group=test_repository.repository_group,
        dvcs_type="git",
        url=url,
        tc_root_url=test_repository.tc_root_url,
    )
    RepositoryBranch.objects.create(repository=catchall_repo, branch="*")

    github_push[0]["payload"]["details"]["event.base.repo.branch"] = "releases/v1"
    PushLoader().process(
        github_push[0]["payload"],
        github_push[0]["exchange"],
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == 0


@pytest.mark.django_db
def test_ingest_github_pull_request_routing(github_pr, test_repository, mock_github_pr_commits):
    """PR events route to repos with accepts_pull_requests=True"""
    test_repository.url = github_pr["details"]["event.base.repo.url"].replace(".git", "")
    test_repository.accepts_pull_requests = True
    test_repository.save()
    assert Push.objects.count() == 0
    PushLoader().process(
        github_pr,
        "exchange/taskcluster-github/v1/pull-request",
        "https://firefox-ci-tc.services.mozilla.com",
    )
    assert Push.objects.count() == 1


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
