import copy
import os

import pytest
import responses

from treeherder.etl.push_loader import (GithubPullRequestTransformer,
                                        GithubPushTransformer,
                                        HgPushTransformer,
                                        PulsePushError,
                                        PushLoader)
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


@pytest.fixture
def mock_github_pr_commits(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data/pulse_consumer",
        "github_pr_commits.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, "https://api.github.com/repos/mozilla/test_treeherder/pulls/1692/commits",
                  body=mocked_content, status=200,
                  content_type='application/json')


@pytest.fixture
def mock_github_push_commits(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data/pulse_consumer",
        "github_push_commits.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, "https://api.github.com/repos/mozilla-services/test_treeherder/commits",
                  body=mocked_content, status=200, match_querystring=False,
                  content_type='application/json')


@pytest.fixture
def mock_hg_push_commits(activate_responses):
    tests_folder = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(
        tests_folder,
        "sample_data/pulse_consumer",
        "hg_push_commits.json"
    )
    with open(path) as f:
        mocked_content = f.read()
    responses.add(responses.GET, "https://hg.mozilla.org/try/json-pushes",
                  body=mocked_content, status=200, match_querystring=False,
                  content_type='application/json')


@pytest.mark.parametrize("exchange, transformer_class", [
    ("exchange/taskcluster-github/v1/push", GithubPushTransformer),
    ("exchange/taskcluster-github/v1/pull-request", GithubPullRequestTransformer)])
def test_get_transformer_class(exchange, transformer_class):
    rsl = PushLoader()
    assert rsl.get_transformer_class(exchange) == transformer_class


def test_unsupported_exchange():
    with pytest.raises(PulsePushError):
        rsl = PushLoader()
        rsl.get_transformer_class("meh")


def test_ingest_github_pull_request(test_repository, github_pr, transformed_github_pr,
                                    mock_github_pr_commits):
    xformer = GithubPullRequestTransformer(github_pr)
    push = xformer.transform(test_repository.name)
    assert transformed_github_pr == push


def test_ingest_github_push(test_repository, github_push, transformed_github_push,
                            mock_github_push_commits):
    xformer = GithubPushTransformer(github_push)
    push = xformer.transform(test_repository.name)
    assert transformed_github_push == push


def test_ingest_hg_push(test_repository, hg_push, transformed_hg_push,
                        mock_hg_push_commits):
    xformer = HgPushTransformer(hg_push)
    push = xformer.transform(test_repository.name)
    assert transformed_hg_push == push


@pytest.mark.django_db
def test_ingest_hg_push_bad_repo(hg_push):
    """Test graceful handling of an unknown HG repo"""
    hg_push["payload"]["repo_url"] = "https://bad.repo.com"
    PushLoader().process(hg_push, "exchange/hgpushes/v1")
    assert Push.objects.count() == 0


@pytest.mark.django_db
def test_ingest_github_push_bad_repo(github_push):
    """Test graceful handling of an unknown GH repo"""
    github_push["details"]["event.head.repo.url"] = "https://bad.repo.com"
    PushLoader().process(github_push, "exchange/taskcluster-github/v1/push")
    assert Push.objects.count() == 0
