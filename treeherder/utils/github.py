import newrelic.agent
import requests
from django.conf import settings

from treeherder.config.settings import GITHUB_TOKEN


def make_request(url, method='GET', headers=None, timeout=30, **kwargs):
    """A wrapper around requests to set defaults & call raise_for_status()."""
    headers = headers or {}
    headers['User-Agent'] = 'treeherder/{}'.format(settings.SITE_HOSTNAME)
    if url.find("api.github.com") > -1:
        if GITHUB_TOKEN:
            headers["Authorization"] = "token {}".format(GITHUB_TOKEN)
    response = requests.request(method,
                                url,
                                headers=headers,
                                timeout=timeout,
                                **kwargs)
    if response.history:
        params = {
            'url': url,
            'redirects': len(response.history),
            'duration': sum(r.elapsed.total_seconds() for r in response.history)
        }
        newrelic.agent.record_custom_event('RedirectedRequest', params=params)

    response.raise_for_status()
    return response


def fetch_json(url, params=None):
    response = make_request(url,
                            params=params,
                            headers={'Accept': 'application/json'})
    return response.json()


def fetch_text(url):
    response = make_request(url)
    return response.text


def fetch_api(path):
    return fetch_json("https://api.github.com/{}".format(path))


def compare_shas(owner, repo, base, head):
    return fetch_api("repos/{}/{}/compare/{}...{}".format(owner, repo, base, head))


def commits_info(owner, repo):
    return fetch_api("repos/{}/{}/commits".format(owner, repo))


def commit_info(owner, repo, sha):
    return fetch_api("repos/{}/{}/commits/{}".format(owner, repo, sha))
