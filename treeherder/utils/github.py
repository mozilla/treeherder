from github import Auth, Github
from github.Commit import Commit
from github.GitRelease import GitRelease
from github.PullRequest import PullRequest
from github.Repository import Repository

from treeherder.config.settings import GITHUB_TOKEN
from treeherder.utils.http import fetch_json


def fetch_api(path, params=None):
    """
    Deprecated. Use the pygithub methods instead.
    """
    return fetch_api_full_url(f"https://api.github.com/{path}", params)


def fetch_api_full_url(url, params=None):
    """
    Deprecated. Use the pygithub methods instead.
    """
    if GITHUB_TOKEN:
        headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    else:
        headers = {}
    return fetch_json(url, params, headers)


if GITHUB_TOKEN:
    auth = Auth.Token(GITHUB_TOKEN)
    github_client = Github(auth=auth)
else:
    github_client = Github()


def get_repository(owner: str, repo_name: str) -> Repository:
    """
    Returns the PyGithub Repository object for the given repo.
    """
    return github_client.get_repo(full_name_or_id=f"{owner}/{repo_name}")


def compare_shas(owner: str, repo_name: str, base: str, head: str) -> list[Commit]:
    """
    Returns a list of PyGithub Commit object for a comparison of base against head.
    """
    return [
        commit
        for commit in get_repository(owner=owner, repo_name=repo_name)
        .compare(base=base, head=head)
        .commits
    ]


def get_all_commits(owner: str, repo: str, params: None) -> list[Commit]:
    """
    Returns a list of PyGithub Commit objects.
    Optional params: sha, since, until, path, author, committer, per_page.
    """
    return [commit for commit in get_repository(owner=owner, repo_name=repo).get_commits(**params)]


def get_commit(owner: str, repo: str, sha: str) -> Commit:
    """
    Returns the PyGithub Commit object for the given commit hash.
    """
    return get_repository(owner=owner, repo_name=repo).get_commit(sha=sha)


def get_pull_request(owner: str, repo_name: str, pr_number: int) -> PullRequest:
    """
    Returns the PyGithub PullRequest object for the given PR.
    """
    return get_repository(owner, repo_name).get_pull(pr_number)


def get_pull_request_commits(owner: str, repo_name: str, pr_number: str) -> list[Commit]:
    """
    Returns a list of PyGithub Commit objects associated with a given PR.
    """
    return [commit for commit in get_pull_request(owner, repo_name, pr_number).get_commits()]


def get_releases(owner: str, repo_name: str) -> list[GitRelease]:
    """
    Returns a list of PyGithub GitRelease objects associated with a given repository.
    """
    return [release for release in get_repository(owner=owner, repo_name=repo_name).get_releases()]
