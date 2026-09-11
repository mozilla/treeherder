import newrelic.agent
import requests
from django.conf import settings

# Chunk size for `Response.iter_lines()` when streaming logs. The default (512 bytes)
# re-concatenates the pending partial line on every chunk, which is quadratic in the
# length of a single line: an 8 MB line takes ~20 s and hundreds of MB, and a multi-MB
# PERFHERDER_DATA line can run for many minutes. A 1 MB chunk makes it linear.
ITER_LINES_CHUNK_SIZE = 1024 * 1024


def make_request(url, method="GET", headers=None, timeout=30, **kwargs):
    """A wrapper around requests to set defaults & call raise_for_status()."""
    headers = headers or {}
    headers["User-Agent"] = f"treeherder/{settings.SITE_HOSTNAME}"
    response = requests.request(method, url, headers=headers, timeout=timeout, **kwargs)
    if response.history:
        params = {
            "url": url,
            "redirects": len(response.history),
            "duration": sum(r.elapsed.total_seconds() for r in response.history),
        }
        newrelic.agent.record_custom_event("RedirectedRequest", params=params)

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
