import logging

import requests
from requests.exceptions import HTTPError

# The Python client release process is documented here:
# https://treeherder.readthedocs.io/common_tasks.html#releasing-a-new-version-of-the-python-client
__version__ = '5.0.0'

logger = logging.getLogger(__name__)


class TreeherderClient:
    """
    Treeherder client class
    """

    API_VERSION = '1.0'
    REQUEST_HEADERS = {
        'Accept': 'application/json; version={}'.format(API_VERSION),
        'User-Agent': 'treeherder-pyclient/{}'.format(__version__),
    }

    PUSH_ENDPOINT = 'push'
    JOBS_ENDPOINT = 'jobs'
    JOB_DETAIL_ENDPOINT = 'jobdetail'
    JOB_LOG_URL_ENDPOINT = 'job-log-url'
    OPTION_COLLECTION_HASH_ENDPOINT = 'optioncollectionhash'
    REPOSITORY_ENDPOINT = 'repository'
    FAILURE_CLASSIFICATION_ENDPOINT = 'failureclassification'
    MAX_COUNT = 2000

    def __init__(self, server_url='https://treeherder.mozilla.org', timeout=30):
        """
        :param server_url: The site URL of the Treeherder instance (defaults to production)
        :param timeout: maximum time it can take for a request to complete
        """
        self.server_url = server_url
        self.timeout = timeout

        # Using a session gives us automatic keep-alive/connection pooling.
        self.session = requests.Session()
        self.session.headers.update(self.REQUEST_HEADERS)

    def _get_endpoint_url(self, endpoint, project=None):
        if project:
            return '{}/api/project/{}/{}/'.format(self.server_url, project, endpoint)

        return '{}/api/{}/'.format(self.server_url, endpoint)

    def _get_json_list(self, endpoint, project=None, **params):
        if "count" in params and (params["count"] is None or params["count"] > self.MAX_COUNT):
            total = None if params["count"] is None else params["count"]
            count = self.MAX_COUNT
            offset = 0
            data = []
            while True:
                params["count"] = count
                params["offset"] = offset
                new_data = self._get_json(endpoint, project=project, **params)["results"]
                data += new_data
                if len(new_data) < self.MAX_COUNT:
                    return data
                offset += count
                if total is not None:
                    count = min(total - offset, self.MAX_COUNT)
        else:
            return self._get_json(endpoint, project=project, **params)["results"]

    def _get_json(self, endpoint, project=None, **params):
        url = self._get_endpoint_url(endpoint, project=project)

        resp = self.session.get(url, params=params, timeout=self.timeout)
        try:
            resp.raise_for_status()
        except HTTPError:
            logger.error(
                "HTTPError %s requesting %s: %s", resp.status_code, resp.request.url, resp.content
            )
            logger.debug("Request headers: %s", resp.request.headers)
            logger.debug("Response headers: %s", resp.headers)
            raise

        return resp.json()

    def get_option_collection_hash(self):
        """
        Gets option collection hash, a mapping of hash values to build properties

        Returns a dictionary with the following structure:

            {
                hashkey1: [ { key: value }, { key: value }, ... ],
                hashkey2: [ { key: value }, { key: value }, ... ],
                ...
            }
        """
        resp = self._get_json(self.OPTION_COLLECTION_HASH_ENDPOINT)
        ret = {}
        for result in resp:
            ret[result['option_collection_hash']] = result['options']

        return ret

    def get_repositories(self):
        """
        Gets a list of valid treeherder repositories.

        Returns a list with the following structure:

            [
                {name: repository-name, dvcs_type: dcvs-type, ...},
                ...
            ]
        """
        return self._get_json(self.REPOSITORY_ENDPOINT)

    def get_failure_classifications(self):
        """
        Gets a list of failure classification types stored inside Treeherder

        Returns a list of dictionaries with the following properties:

            {
              id: <id>,
              name: <name>,
              description: <description>
            }
        """
        return self._get_json(self.FAILURE_CLASSIFICATION_ENDPOINT)

    def get_pushes(self, project, **params):
        """
        Gets pushes from project, filtered by parameters

        By default this method will just return the latest 10 pushes (if they exist)

        :param project: project (repository name) to query data for
        :param params: keyword arguments to filter results
        """
        return self._get_json_list(self.PUSH_ENDPOINT, project, **params)

    def get_jobs(self, project, **params):
        """
        Gets jobs from project, filtered by parameters

        :param project: project (repository name) to query data for
        :param params: keyword arguments to filter results
        """
        return self._get_json_list(self.JOBS_ENDPOINT, project, **params)

    def get_job_details(self, **params):
        """
        Gets jobs from project, filtered by parameters

        Typically you would filter by `job_guid`. Example:

        details = client.get_job_details(job_guid='22fb7e6b-d4e7-43cb-a268-c897c1112c0f/0')

        :param params: keyword arguments to filter results
        """
        return self._get_json_list(self.JOB_DETAIL_ENDPOINT, None, **params)

    def get_job_log_url(self, project, **params):
        """
        Gets job log url, filtered by parameters

        :param project: project (repository name) to query data for
        :param params: keyword arguments to filter results
        """
        return self._get_json(self.JOB_LOG_URL_ENDPOINT, project, **params)
