import requests
from django.conf import settings


def make_request(url, method="GET", headers=None, timeout=30, **kwargs):
    """A wrapper around requests to set defaults & call raise_for_status()."""
    headers = headers or {}
    headers["User-Agent"] = f"treeherder/{settings.SITE_HOSTNAME}"
    response = requests.request(method, url, headers=headers, timeout=timeout, **kwargs)
    response.raise_for_status()
    return response


def fetch_json(url, params=None, headers=None):
    if headers is None:
        headers = {"Accept": "application/json"}
    else:
        headers["Accept"] = "application/json"
    response = make_request(url, params=params, headers=headers)
    return response.json()


def fetch_text(url):
    response = make_request(url)
    return response.text
