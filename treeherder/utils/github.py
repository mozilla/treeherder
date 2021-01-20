from treeherder.config.settings import GITHUB_TOKEN
from treeherder.utils.http import fetch_json


def fetch_api(path, params=None):
    if GITHUB_TOKEN:
        headers = {"Authorization": "token {}".format(GITHUB_TOKEN)}
    else:
        headers = {}
    return fetch_json("https://api.github.com/{}".format(path), params, headers)


def get_releases(owner, repo, params=None):
    return fetch_api("repos/{}/{}/releases".format(owner, repo), params)


def get_repo(owner, repo, params=None):
    return fetch_api("repos/{}/{}".format(owner, repo), params)


def compare_shas(owner, repo, base, head):
    return fetch_api("repos/{}/{}/compare/{}...{}".format(owner, repo, base, head))


def get_all_commits(owner, repo, params=None):
    return fetch_api("repos/{}/{}/commits".format(owner, repo), params)


def get_commit(owner, repo, sha, params=None):
    return fetch_api("repos/{}/{}/commits/{}".format(owner, repo, sha), params)


def get_pull_request(owner, repo, sha, params=None):
    return fetch_api("repos/{}/{}/pulls/{}/commits".format(owner, repo, sha), params)
