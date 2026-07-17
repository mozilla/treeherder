from datetime import datetime

from github import Auth, Github
from github.GitRelease import GitRelease
from github.Repository import Repository

from treeherder.config.settings import GITHUB_TOKEN
from treeherder.utils.http import fetch_json

if GITHUB_TOKEN:
    auth = Auth.Token(GITHUB_TOKEN)
    github = Github(auth=auth)
else:
    github = Github()


def fetch_api(path, params=None):
    return fetch_api_full_url(f"https://api.github.com/{path}", params)


def fetch_api_full_url(url, params=None):
    if GITHUB_TOKEN:
        headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    else:
        headers = {}
    return fetch_json(url, params, headers)


def get_repo(owner, repo, params=None):
    return fetch_api(f"{owner}/{repo}", params)


def pygithub_get_repo(owner, repo) -> Repository:
    return github.get_repo(f"{owner}/{repo}")


def get_releases(owner: str, repo: str, params: dict = None) -> list[GitRelease]:
    """
    Retrieve GitHub releases for a given repository.

    Args:
        owner (str): The owner of the repository (e.g., 'mozilla').
        repo (str): The name of the repository (e.g., 'treeherder').
        params (dict, optional): A dictionary of parameters to filter releases.
            Supported parameters:
            - "number" (int): The maximum number of releases to return.
            - "since" (str): An ISO 8601 formatted datetime string
                             (e.g., "YYYY-MM-DDTHH:MM:SS") to filter releases
                             published on or after this date.

    Returns:
        list[GitRelease]: A list of GitRelease objects, filtered by the given parameters.
                          Releases are ordered from oldest to newest by published_at,
                          then by number if applicable.
    """
    releases = list(pygithub_get_repo(owner, repo).get_releases())

    if params:
        if "number" in params:
            releases = releases[: params.get("number")]

        if "since" in params:
            since_datetime = datetime.fromisoformat(params["since"])
            releases = list(
                filter(
                    lambda release: release.published_at >= since_datetime,
                    releases,
                )
            )
    return releases


def compare_shas(owner, repo, base, head):
    repo = pygithub_get_repo(owner, repo)
    comparison = repo.compare(base, head)
    return [commit for commit in comparison.commits]


def get_all_commits(owner, repo, params=None):
    return fetch_api(f"repos/{owner}/{repo}/commits", params)


def get_commit(owner, repo, sha, params=None):
    return fetch_api(f"repos/{owner}/{repo}/commits/{sha}", params)


def get_pull_request(owner, repo, pr_id):
    repo = pygithub_get_repo(owner, repo)
    return repo.get_pull(pr_id)


def get_pull_request_commits(owner, repo, pr_id):
    pr = get_pull_request(owner, repo, pr_id)
    return [commit for commit in pr.get_commits()]
