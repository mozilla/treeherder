import hashlib
import logging
import re

import requests
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


class JobDataError(ValueError):
    pass


class JobData(dict):

    """
    Encapsulates data access from incoming test data structure.

    All missing-data errors raise ``JobDataError`` with a useful
    message. Unlike regular nested dictionaries, ``JobData`` keeps track of
    context, so errors contain not only the name of the immediately-missing
    key, but the full parent-key context as well.
    """

    def __init__(self, data, context=None):
        """Initialize ``JobData`` with a data dict and a context list."""
        self.context = context or []
        super(JobData, self).__init__(data)

    def __getitem__(self, name):
        """Get a data value, raising ``JobDataError`` if missing."""
        full_context = list(self.context) + [name]

        try:
            value = super(JobData, self).__getitem__(name)
        except KeyError:
            raise JobDataError("Missing data: {0}.".format(
                "".join(["['{0}']".format(c) for c in full_context])))

        # Provide the same behavior recursively to nested dictionaries.
        if isinstance(value, dict):
            value = self.__class__(value, full_context)

        return value


def make_request(url, method='GET', headers=None,
                 timeout=settings.REQUESTS_TIMEOUT, **kwargs):
    """A wrapper around requests to set defaults & call raise_for_status()."""
    headers = headers or {}
    headers['User-Agent'] = settings.TREEHERDER_USER_AGENT
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


def lookup_revisions(revision_dict):
    """
    Retrieve a list of revision->resultset lookups
    """
    from treeherder.model.derived import JobsModel

    lookup = dict()
    for project, revisions in revision_dict.items():
        revision_list = list(set(revisions))

        with JobsModel(project) as jm:
            lookup_content = jm.get_resultset_all_revision_lookup(revision_list)

        if lookup_content:
            lookup[project] = lookup_content
    return lookup


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
