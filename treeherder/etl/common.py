import hashlib
import logging
import time

import requests
import simplejson as json
from django.conf import settings

logger = logging.getLogger(__name__)


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

    @classmethod
    def from_json(cls, json_blob):
        """Create ``JobData`` from a JSON string."""
        try:
            data = json.loads(json_blob)
        except ValueError as e:
            raise JobDataError("Malformed JSON: {0}".format(e))
        return cls(data)

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
            lookup_content = jm.get_revision_resultset_lookup(revision_list)

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


def generate_revision_hash(revisions):
    """Builds the revision hash for a set of revisions"""

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


def fetch_missing_resultsets(source, missing_resultsets, logger):
    """
    Schedules refetch of resultsets based on ``missing_revisions``
    """
    for k, v in missing_resultsets.iteritems():
        missing_resultsets[k] = list(v)

    logger.warn(
        "Found {0} jobs with missing resultsets.  Scheduling re-fetch: {1}".format(
            source,
            missing_resultsets
        )
    )
    from treeherder.etl.tasks.cleanup_tasks import fetch_missing_push_logs
    fetch_missing_push_logs.apply_async(
        args=[missing_resultsets],
        routing_key="fetch_missing_push_logs")


def get_resultset(project, revisions_lookup, revision, missing_resultsets, logger):
    """
    Get the resultset out of the revisions_lookup for the given revision.

    This is a little complex due to our attempts to get missing resultsets
    in case we see jobs that, for one reason or another, we didn't get the
    resultset from json-pushes.

    This may raise a KeyError if the project or revision isn't found in the
    lookup..  This signals that the job should be skipped
    """

    resultset_lookup = revisions_lookup[project]
    try:
        resultset = resultset_lookup[revision]

        # we can ingest resultsets that are not active for various
        # reasons.  One would be that the data from pending/running/
        # builds4hr may have a bad revision (from the wrong repo).
        # in this case, we ingest the resultset as inactive so we
        # don't keep re-trying to find it when we hit jobs like this.
        # Or, the resultset could be inactive for other reasons.
        # Either way, we don't want to ingest jobs for it.
        if resultset.get("active_status", "active") != "active":
            logger.info(("Skipping job for non-active "
                         "resultset/revision: {0}").format(
                revision))

    except KeyError as ex:
        # we don't have the resultset for this build/job yet
        # we need to queue fetching that resultset
        if revision not in ["Unknown", None]:
            missing_resultsets[project].add(revision)
        raise ex

    return resultset


def get_not_found_onhold_push(url, revision):
    return {
        "pushes": {
            "00001": {
                "date": int(time.time()),
                "changesets": [
                    {
                        "node": revision,
                        "tags": [],
                        "author": "Unknown",
                        "branch": "default",
                        "desc": "Pushlog not found at {0}".format(url)
                    }
                ],
                "user": "Unknown",
                "active_status": "onhold"
            }
        }
    }
