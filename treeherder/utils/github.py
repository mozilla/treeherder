from github import Auth, Github

from treeherder.config.settings import GITHUB_TOKEN
from treeherder.utils.http import fetch_json

def get_github_client():
    if GITHUB_TOKEN:
        return Github(auth=Auth.Token(GITHUB_TOKEN))
    return Github()


def fetch_api(path, params=None):
    return fetch_api_full_url(f"https://api.github.com/{path}", params)


def fetch_api_full_url(url, params=None):
    if GITHUB_TOKEN:
        headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    else:
        headers = {}
    return fetch_json(url, params, headers)


def get_releases(owner, repo, params=None):
    return fetch_api(f"repos/{owner}/{repo}/releases", params)


def get_repo(owner, repo, params=None):
    return fetch_api(f"repos/{owner}/{repo}", params)


def pygithub_get_repo(owner, repo):
    return get_github_client().get_repo(f"{owner}/{repo}")


def compare_shas(owner, repo, base, head):
    repo = pygithub_get_repo(owner, repo)
    comparison = repo.compare(base, head)
    return [commit for commit in comparison.get_commits()]


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
