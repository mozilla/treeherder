import copy
import os

import pytest
import responses

from treeherder.etl.resultset_loader import (GithubPullRequestTransformer,
                                             GithubPushTransformer,
                                             ResultsetLoader)


@pytest.fixture
def github_push(sample_data):
    return copy.deepcopy(sample_data.github_push)


@pytest.fixture
def github_pr(sample_data):
    return copy.deepcopy(sample_data.github_pr)


@pytest.fixture
def transformed_github_push(sample_data):
    return copy.deepcopy(sample_data.transformed_github_push)


@pytest.fixture
def transformed_github_pr(sample_data):
    return copy.deepcopy(sample_data.transformed_github_pr)


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


@pytest.mark.parametrize("exchange, transformer_class", [
    ("exchange/taskcluster-github/v1/push", GithubPushTransformer),
    ("exchange/taskcluster-github/v1/pull-request", GithubPullRequestTransformer)])
def test_get_transformer_class(exchange, transformer_class):
    rsl = ResultsetLoader()
    assert rsl.get_transformer_class(exchange) == transformer_class


def test_ingest_github_pull_request(jm, github_pr, transformed_github_pr,
                                    mock_github_pr_commits):
    xformer = GithubPullRequestTransformer(github_pr)
    resultset = xformer.transform(jm.project)
    assert transformed_github_pr == resultset


def test_ingest_github_push(jm, github_push, transformed_github_push,
                            mock_github_push_commits):
    xformer = GithubPushTransformer(github_push)
    resultset = xformer.transform(jm.project)
    assert transformed_github_push == resultset
