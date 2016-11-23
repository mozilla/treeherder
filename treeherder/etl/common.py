import calendar
import hashlib
import logging
import re

import requests
from dateutil import parser
from django.conf import settings

logger = logging.getLogger(__name__)
REVISION_SHA_RE = re.compile(r'^[a-f\d]{12,40}$', re.IGNORECASE)


class CollectionNotStoredException(Exception):

    def __init__(self, error_list, *args, **kwargs):
        """
        error_list contains dictionaries, each containing
        project, url and message
        """
        super(CollectionNotStoredException, self).__init__(args, kwargs)
        self.error_list = error_list

    def __str__(self):
        return "\n".join(
            ["[{project}] Error storing {collection} data: {message}".format(
                **error) for error in self.error_list]
        )


def make_request(url, method='GET', headers=None,
                 timeout=settings.REQUESTS_TIMEOUT, **kwargs):
    """A wrapper around requests to set defaults & call raise_for_status()."""
    headers = headers or {}
    headers['User-Agent'] = settings.TREEHERDER_USER_AGENT
    # Work around bug 1305768.
    if 'queue.taskcluster.net' in url:
        headers['x-taskcluster-skip-cache'] = 'true'
    response = requests.request(method,
                                url,
                                headers=headers,
                                timeout=timeout,
                                **kwargs)
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


def should_skip_project(project, valid_projects, project_filter):
    if project_filter and project != project_filter:
        return True
    if project not in valid_projects:
        logger.info("Skipping unknown branch: %s", project)
        return True
    return False


def should_skip_revision(revision, revision_filter):
    if revision_filter and revision != revision_filter:
        return True
    if not revision or not REVISION_SHA_RE.match(revision):
        logger.info("Skipping invalid revision SHA: %s", revision)
        return True
    return False


def generate_revision_hash(revisions):
    """
    Builds the revision hash for a set of revisions
    TODO: Remove this with Bug 1257602 is addressed
    """

    sh = hashlib.sha1()
    sh.update(
        ''.join(map(lambda x: str(x), revisions))
    )

    return sh.hexdigest()


def generate_job_guid(request_id, buildername, endtime=None):
    """Converts a request_id and buildername into a guid"""
    sh = hashlib.sha1()

    sh.update(str(request_id))
    sh.update(str(buildername))
    job_guid = sh.hexdigest()

    # for some jobs (I'm looking at you, ``retry``) we need the endtime to be
    # unique because the job_guid otherwise looks identical
    # for all retries and the complete job.  The ``job_guid`` needs to be
    # unique, or else each retry will overwrite the last, and finally the complete
    # job will overwrite that.  Then you'll never know there were any retries.
    if endtime:
        job_guid = "{0}_{1}".format(job_guid, str(endtime)[-5:])
    return job_guid


def get_guid_root(guid):
    """Converts a job_guid with endtime suffix to normal job_guid"""
    if "_" in str(guid):
        return str(guid).split("_", 1)[0]
    return guid


def to_timestamp(datestr):
    """Converts a date string to a UTC timestamp"""
    return calendar.timegm(parser.parse(datestr).utctimetuple())
