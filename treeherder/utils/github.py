from treeherder.etl.common import fetch_json


def fetch_api(path):
    return fetch_json("https://api.github.com/{}".format(path))


def compare_shas(_repo, base, head):
    return fetch_api("repos/{}/{}/compare/{}...{}".format(_repo["owner"], _repo["repo"], base, head))


def commits_info(_repo):
    return fetch_api("repos/{}/{}/commits".format(_repo["owner"], _repo["repo"]))


def commit_info(_repo, sha):
    return fetch_api("repos/{}/{}/commits/{}".format(_repo["owner"], _repo["repo"], sha))
