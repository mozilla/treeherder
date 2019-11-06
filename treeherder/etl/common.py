import calendar

import newrelic.agent
import requests
from dateutil import parser
from django.conf import settings


def make_request(url, method='GET', headers=None, timeout=30, **kwargs):
    """A wrapper around requests to set defaults & call raise_for_status()."""
    headers = headers or {}
    headers['User-Agent'] = 'treeherder/{}'.format(settings.SITE_HOSTNAME)
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


def get_guid_root(guid):
    """Converts a job_guid with endtime suffix to normal job_guid"""
    if "_" in str(guid):
        return str(guid).split("_", 1)[0]
    return guid


def to_timestamp(datestr):
    """Converts a date string to a UTC timestamp"""
    return calendar.timegm(parser.parse(datestr).utctimetuple())
