from treeherder.config.settings import GITHUB_TOKEN
from treeherder.utils.http import fetch_json


def fetch_api(path, params=None):
    if GITHUB_TOKEN:
        headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    else:
        headers = {}
    return fetch_json(f"https://api.github.com/{path}", params, headers)


def get_releases(owner, repo, params=None):
    return fetch_api(f"repos/{owner}/{repo}/releases", params)


def get_repo(owner, repo, params=None):
    return fetch_api(f"repos/{owner}/{repo}", params)


def compare_shas(owner, repo, base, head):
    return fetch_api(f"repos/{owner}/{repo}/compare/{base}...{head}")


def get_all_commits(owner, repo, params=None):
    return fetch_api(f"repos/{owner}/{repo}/commits", params)


def get_commit(owner, repo, sha, params=None):
    return fetch_api(f"repos/{owner}/{repo}/commits/{sha}", params)


def get_pull_request(owner, repo, sha, params=None):
    return fetch_api(f"repos/{owner}/{repo}/pulls/{sha}/commits", params)
