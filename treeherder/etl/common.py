from collections import defaultdict
import hashlib
import urllib2
import simplejson as json

from django.core.urlresolvers import reverse
from django.conf import settings
from django.core.cache import cache

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


def retrieve_api_content(url):
    req = urllib2.Request(url)
    req.add_header('Content-Type', 'application/json')
    conn = urllib2.urlopen(req)
    if conn.getcode() == 404:
        return None


def get_remote_content(url):
    """A thin layer of abstraction over urllib. """
    req = urllib2.Request(url)
    req.add_header('Accept', 'application/json')
    req.add_header('Content-Type', 'application/json')
    conn = urllib2.urlopen(req)

    if not conn.getcode() == 200:
        return None
    try:
        content = json.loads(conn.read())
    except:
        content = None
    finally:
        conn.close()

    return content


def lookup_revisions(revision_dict):
    """
    Retrieve a list of revision->resultset lookups
    """
    lookup = dict()
    for project, revisions in revision_dict.items():
        revision_set = set(revisions)
        endpoint = reverse('revision-lookup-list', kwargs={"project": project})
        # build the query string as a comma separated list of revisions
        q = ','.join(revision_set)
        url = "{0}/{1}/?revision={2}".format(
            settings.API_HOSTNAME.strip('/'),
            endpoint.strip('/'),
            q
        )

        content = get_remote_content(url)
        if content:
            lookup[project] = content
    return lookup


def generate_revision_hash(revisions):
    """Builds the revision hash for a set of revisions"""

    sh = hashlib.sha1()
    sh.update(
        ''.join(map(lambda x: str(x), revisions))
    )

    return sh.hexdigest()


def generate_job_guid(request_id, request_time):
    """Converts a request_id and request_time into a guid"""
    sh = hashlib.sha1()

    sh.update(str(request_id))
    sh.update(str(request_time))

    return sh.hexdigest()

