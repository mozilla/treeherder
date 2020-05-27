import newrelic.agent
import requests
from django.conf import settings


def create_bugzilla_session(bugzilla_api_key=None):
    session = requests.Session()
    headers = {
        'User-Agent': 'treeherder/{}'.format(settings.SITE_HOSTNAME),
        'Accept': 'application/json',
    }
    if bugzilla_api_key is not None:
        headers['x-bugzilla-api-key'] = bugzilla_api_key

    # Use a custom HTTP adapter, so we can set a non-zero max_retries value.
    session.mount("https://", requests.adapters.HTTPAdapter(max_retries=3))
    session.headers = headers
    return session


def make_request(url, method='GET', headers=None, timeout=30, **kwargs):
    """A wrapper around requests to set defaults & call raise_for_status()."""
    headers = headers or {}
    headers['User-Agent'] = 'treeherder/{}'.format(settings.SITE_HOSTNAME)
    response = requests.request(method, url, headers=headers, timeout=timeout, **kwargs)
    if response.history:
        params = {
            'url': url,
            'redirects': len(response.history),
            'duration': sum(r.elapsed.total_seconds() for r in response.history),
        }
        newrelic.agent.record_custom_event('RedirectedRequest', params=params)

    response.raise_for_status()
    return response


def fetch_json(url, params=None, headers=None):
    if headers is None:
        headers = {'Accept': 'application/json'}
    else:
        headers['Accept'] = 'application/json'
    response = make_request(url, params=params, headers=headers)
    return response.json()


def fetch_text(url):
    response = make_request(url)
    return response.text
