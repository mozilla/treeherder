from __future__ import unicode_literals

import json
import logging

import requests
from requests.exceptions import HTTPError
from requests_hawk import HawkAuth

# The Python client release process is documented here:
# https://treeherder.readthedocs.io/common_tasks.html#releasing-a-new-version-of-the-python-client
__version__ = '3.0.0'

logger = logging.getLogger(__name__)


class ValidatorMixin(object):

    def validate(self, required_properties={}):
        """
        Implement job object validation rules. If a rule fails to validate
        raise TreeherderClientError

        Classes using this mixin should implement a required_properties
        dict. The keys in this dict are the required keys in the struture
        contained in self.data. Nested keys can be specified with the '.'
        operator. Each key in required_properties should have a dict value
        like so:

            {
                'len':optional, some int, max allowed len of property value
                'type':optional, some data type, required type of property
                       value
                'cb': some function reference, called with
                      list of keys, list of values, required_properties key
            }

        Example:

            self.required_properties = {
                'revision':{
                    'len':40, 'cb':self.validate_existence
                    },
                'project':{
                    'cb':self.validate_existence
                    },
                'job':{
                    'type':dict, 'cb':self.validate_existence
                    },
                'job.job_guid':{
                    'len':50, 'cb':self.validate_existence
                    }
                }
        """
        required_properties = required_properties or self.required_properties

        for prop in required_properties:

            cb = required_properties[prop]['cb']

            cb(prop.split('.'), required_properties[prop], prop)

    def validate_existence(self, keys, values, property_key):
        """
        This required_properties callback method confirms the following.

            - The keys provided are found in required_properties
            - The type of the values match the specified type
            - The values are defined and less than the required len
              if a len is specified

        If any of these assertions fail TreeherderClientError is raised
        """

        # missing keys
        missing_keys = []
        property_errors = ''

        # get value
        v = None
        for index, k in enumerate(keys):
            if index > 0:
                try:
                    v = v[k]
                except KeyError:
                    missing_keys.append(k)
            else:
                try:
                    v = self.data[k]
                except KeyError:
                    missing_keys.append(k)

        if missing_keys:
            property_errors += ('\tThe required Property, {0}, is '
                                'missing\n'.format('.'.join(missing_keys)))

        if not v:
            property_errors += '\tValue not defined for {0}\n'.format(
                property_key)
        elif ('type' in values) and (not isinstance(v, values['type'])):
            property_errors += ('\tThe value type, {0}, should be '
                                '{1}\n'.format(type(v), values['type']))

        max_limit = values.get('len', None)
        if v and max_limit and (len(v) > max_limit):
            property_errors += ('\tValue length exceeds maximum {0} char '
                                'limit: {1}\n'.format(str(max_limit), str(v)))

        if property_errors:

            msg = ('{0} structure validation errors detected for property:{1}'
                   '\n{2}\n{3}\n'.format(
                       self.__class__.__name__, property_key, property_errors,
                       json.dumps(self.data)))

            raise TreeherderClientError(msg, [])


class TreeherderData(object):

    def __init__(self, data={}):

        self.data = {}

        if data:
            self.data = data
        else:
            self.init_data()

    def to_json(self):
        return json.dumps(self.data)


class TreeherderJob(TreeherderData, ValidatorMixin):

    PARSE_STATUSES = {'pending', 'parsed', 'error'}

    def __init__(self, data={}):

        super(TreeherderJob, self).__init__(data)

        # Provide minimal json structure validation
        self.required_properties = {
            'revision': {'len': 40, 'cb': self.validate_existence},
            'project': {'cb': self.validate_existence},
            'job': {'type': dict, 'cb': self.validate_existence},
            'job.job_guid': {'len': 50, 'cb': self.validate_existence}
            }

    def add_revision_hash(self, revision_hash):
        """
        DEPRECATED:  Use ``add_revision`` to add the 40 character top
        revision for this job.
        """
        logger.warn("DEPRECATED: Use ``add_revision`` to add the " +
                    "40 character top revision instead.")
        self.data['revision_hash'] = revision_hash

    def add_revision(self, revision):
        self.data['revision'] = revision

    def add_coalesced_guid(self, guids):
        if guids:
            self.data['coalesced'].extend(guids)

    def add_project(self, project):
        self.data['project'] = project

    def add_job_guid(self, guid):
        self.data['job']['job_guid'] = guid

    def add_job_name(self, name):
        self.data['job']['name'] = name

    def add_job_symbol(self, symbol):
        self.data['job']['job_symbol'] = symbol

    def add_group_name(self, name):
        self.data['job']['group_name'] = name

    def add_group_symbol(self, symbol):
        self.data['job']['group_symbol'] = symbol

    def add_description(self, desc):
        self.data['job']['desc'] = desc

    def add_product_name(self, name):
        self.data['job']['product_name'] = name

    def add_state(self, state):
        self.data['job']['state'] = state

    def add_result(self, result):
        self.data['job']['result'] = result

    def add_reason(self, reason):
        self.data['job']['reason'] = reason

    def add_who(self, who):
        self.data['job']['who'] = who

    def add_submit_timestamp(self, tstamp):
        self.data['job']['submit_timestamp'] = tstamp

    def add_start_timestamp(self, tstamp):
        self.data['job']['start_timestamp'] = tstamp

    def add_end_timestamp(self, tstamp):
        self.data['job']['end_timestamp'] = tstamp

    def add_machine(self, machine):
        self.data['job']['machine'] = machine

    def add_build_info(self, os_name, platform, arch):
        self.data['job']['build_platform']['os_name'] = os_name
        self.data['job']['build_platform']['platform'] = platform
        self.data['job']['build_platform']['architecture'] = arch

    def add_machine_info(self, os_name, platform, arch):
        self.data['job']['machine_platform']['os_name'] = os_name
        self.data['job']['machine_platform']['platform'] = platform
        self.data['job']['machine_platform']['architecture'] = arch

    def add_option_collection(self, option_collection):
        if option_collection:
            self.data['job']['option_collection'].update(option_collection)

    def add_tier(self, tier):
        self.data['job']['tier'] = tier

    def add_log_reference(self, name, url, parse_status='pending'):
        """
        parse_status - one of 'pending', 'parsed' or 'error'
        """
        if parse_status not in self.PARSE_STATUSES:
            msg = "{0}: Invalid parse_status '{1}': must be one of: {2}".format(
                self.__class__.__name__,
                parse_status,
                ', '.join(self.PARSE_STATUSES)
                )
            raise TreeherderClientError(msg, [])

        if name and url:
            self.data['job']['log_references'].append(
                {'url': url, 'name': name, 'parse_status': parse_status}
                )

    def add_artifact(self, name, artifact_type, blob):
        if blob:
            self.data['job']['artifacts'].append({
                'name': name,
                'type': artifact_type,
                'blob': blob,
                'job_guid': self.data['job']['job_guid']
            })

    def init_data(self):

        self.data = {

            'revision': '',

            'project': '',

            'job': {
                # Stored in project_jobs_1.job.job_guid
                'job_guid': '',

                # Stored in treeherder_reference_1.job_type.name
                'name': '',

                # Stored in treeherder_reference_1.job_type.name
                'desc': '',

                # Stored symbol represending the job in the UI
                # Stored in treeherder_reference_1.job_type.symbol
                'job_symbol': '',

                # human readable group name (can be null)
                # Stored in treeherder_reference_1.job_group.name
                'group_name': '',

                # Stored symbol representing the job group (can be null)
                # Stored in treeherder_reference_1.job_group.symbol
                'group_symbol': '',

                # Stored in treeherder_reference_1.product
                'product_name': '',

                # Stored in project_jobs_1.job.state
                'state': '',

                # Stored in project_jobs_1.job.result
                'result': '',

                # Stored in project_jobs_1.job.reason
                'reason': '',

                # Stored in project_jobs_1.job.who
                'who': '',

                # Stored in project_jobs_1.job.submit_timestamp
                'submit_timestamp': '',

                # Stored in project_jobs_1.job.start_timestamp
                'start_timestamp': '',

                # Stored in project_jobs_1.job.end_timestamp
                'end_timestamp': '',

                # Stored in treeherder_reference_1.machine.name
                'machine': '',

                # Stored in
                # treeherder_reference_1.build_platform.os_name,
                # treeherder_reference_1.build_platform.platform,
                # treeherder_reference_1.build_platform.architecture,
                'build_platform': {
                    'os_name': '', 'platform': '', 'architecture': ''},

                # Stored in:
                # treeherder_reference_1.machine_platform.os_name,
                # treeherder_reference_1.machine_platform.platform,
                # treeherder_reference_1.machine_platform.architecture,
                'machine_platform': {
                    'os_name': '', 'platform': '', 'architecture': ''},

                # Stored in treeherder_reference_1.option_collection and
                # treeherder_reference_1.option
                # Ex: 'debug | pgo | asan | opt': True
                'option_collection': {},

                # Stored in treeherder_reference_1.job_log_url
                # Example:
                # log_references: [
                #    { url: 'http://ftp.mozilla.org/mozilla.org/firefox.gz',
                #      name: 'unittest' },
                'log_references': [],

                # Stored in
                # project_jobs_1.job_artifact.name
                # project_jobs_1.job_artifact.type
                # project_jobs_1.job_artifact.blob
                'artifacts': []
            },

            # List of job_guids that were coallesced to this job
            # Stored in project_jobs_1.job.coalesced_job_guid
            # Where the value of coalesced_job_guid is set to job_guid
            # for the list of job_guids provided in coalesced
            'coalesced': []
            }


class TreeherderRevision(TreeherderData, ValidatorMixin):
    """
    Supports building a revision structure that is contained in
    TreeherderResultSet.
    """

    def __init__(self, data={}):

        super(TreeherderRevision, self).__init__(data)

        # Provide minimal json structure validation
        self.required_properties = {
            'revision': {'len': 50, 'cb': self.validate_existence},
            'repository': {'cb': self.validate_existence},
            }

    def init_data(self):

        self.data = {
            # Stored in project_jobs_1.revision.author
            'author': '',
            # Stored in project_jobs_1.revision.comments
            'comment': '',
            # Stored in treeherder_reference_1.repository.name
            'repository': '',
            # Stored in project_jobs_1.revision.revision
            'revision': '',
            }

    def add_author(self, author):
        self.data['author'] = author

    def add_comment(self, comment):
        self.data['comment'] = comment

    def add_repository(self, repository):
        self.data['repository'] = repository

    def add_revision(self, revision):
        self.data['revision'] = revision


class TreeherderResultSet(TreeherderData, ValidatorMixin):
    """
    Supports building a treeherder result set
    """

    def __init__(self, data={}):

        super(TreeherderResultSet, self).__init__(data)

        self.required_properties = {
            'revision': {'len': 40, 'cb': self.validate_existence},
            'revisions': {'type': list, 'cb': self.validate_existence},
            'author': {'len': 150, 'cb': self.validate_existence}
            }

    def init_data(self):

        self.data = {
            # Stored in project_jobs_1.result_set.push_timestamp
            'push_timestamp': None,
            # Stored in project_jobs_1.result_set.long_revision
            'revision': '',
            # Stored in project_jobs_1.result_set.author
            'author': '',
            # Stored in project_jobs_1.revision, new row per revision
            'revisions': [],
            # TODO: add type column to resultset in treeherder-service
            'type': '',
        }

    def add_push_timestamp(self, push_timestamp):
        self.data['push_timestamp'] = push_timestamp

    def add_author(self, author):
        self.data['author'] = author

    def add_revisions(self, revisions):
        for revision in revisions:
            self.data['revisions'].append(revision.data)

    def add_revision(self, revision):
        self.data['revision'] = revision

    def add_type(self, resultset_type):
        self.data['type'] = resultset_type

    def get_revision(self, data={}):
        return TreeherderRevision(data)


class TreeherderArtifact(TreeherderData, ValidatorMixin):
    """
    Supports building a treeherder job artifact
    """

    def __init__(self, data={}):

        super(TreeherderArtifact, self).__init__(data)

        # Provide minimal json structure validation
        self.required_properties = {
            'blob': {'cb': self.validate_existence},
            'type': {'cb': self.validate_existence},
            'name': {'cb': self.validate_existence},
            'job_guid': {'cb': self.validate_existence}
        }

    def init_data(self):

        self.data = {
            # Stored in project_jobs_1.artifact.blob
            'blob': '',
            # Stored in project_jobs_1.artifact.type
            'type': '',
            # Stored in project_jobs_1.artifact.name
            'name': '',
            # Stored in project_jobs_1.artifact.job_guid
            'job_guid': None
        }

    def add_blob(self, blob):
        self.data['blob'] = blob

    def add_type(self, type):
        self.data['type'] = type

    def add_name(self, name):
        self.data['name'] = name

    def add_job_guid(self, job_guid):
        self.data['job_guid'] = job_guid


class TreeherderCollection(object):
    """
    Base class for treeherder data collections
    """

    def __init__(self, endpoint_base, data=[]):

        self.data = []
        self.endpoint_base = endpoint_base

        if data:
            self.data = data

    def get_collection_data(self):
        """
        Build data structure containing the data attribute only for
        each item in the collection
        """
        data_struct = []
        for datum_instance in self.data:
            data_struct.append(datum_instance.data)
        return data_struct

    def to_json(self):
        """
        Convert list of data objects to json
        """
        return json.dumps(self.get_collection_data())

    def add(self, datum_instance):
        """
        Add a data structure class instance to data list
        """
        self.data.append(datum_instance)

    def validate(self):
        """
        validate the data structure class
        """
        for d in self.data:
            d.validate()

    def get_chunks(self, chunk_size):
        """
        Return a generator of new collections broken into chunks of size ``chunk_size``.

        Each chunk will be a ``TreeherderCollection`` of the same
        type as the original with a max of ``chunk_size`` count of
        ``TreeherderData`` objects.

        Each collection must then be POSTed individually.
        """
        for i in range(0, len(self.data), chunk_size):
            # we must copy not only the data chunk,
            # but also the endpoint_base or any other field of the
            # collection.  In the case of a TreeherderJobCollection,
            # this is determined in the constructor.

            chunk = self.__class__(self.data[i:i + chunk_size])
            chunk.endpoint_base = self.endpoint_base
            yield chunk


class TreeherderJobCollection(TreeherderCollection):
    """
    Collection of job objects
    """

    def __init__(self, data=[]):

        super(TreeherderJobCollection, self).__init__('jobs', data)

    def get_job(self, data={}):

        return TreeherderJob(data)


class TreeherderResultSetCollection(TreeherderCollection):
    """
    Collection of result set objects
    """

    def __init__(self, data=[]):

        super(TreeherderResultSetCollection, self).__init__('resultset', data)

    def get_resultset(self, data={}):

        return TreeherderResultSet(data)


class TreeherderArtifactCollection(TreeherderCollection):
    """
    Collection of job artifacts
    """

    def __init__(self, data=[]):

        super(TreeherderArtifactCollection, self).__init__('artifact', data)

    def get_artifact(self, data={}):

        return TreeherderArtifact(data)


class TreeherderClient(object):
    """
    Treeherder client class
    """

    PROTOCOLS = {'http', 'https'}  # supported protocols
    API_VERSION = '1.0'
    REQUEST_HEADERS = {
        'Accept': 'application/json; version={}'.format(API_VERSION),
        'User-Agent': 'treeherder-pyclient/{}'.format(__version__),
    }

    RESULTSET_ENDPOINT = 'resultset'
    JOBS_ENDPOINT = 'jobs'
    JOB_LOG_URL_ENDPOINT = 'job-log-url'
    ARTIFACTS_ENDPOINT = 'artifact'
    OPTION_COLLECTION_HASH_ENDPOINT = 'optioncollectionhash'
    REPOSITORY_ENDPOINT = 'repository'
    JOBGROUP_ENDPOINT = 'jobgroup'
    JOBTYPE_ENDPOINT = 'jobtype'
    PRODUCT_ENDPOINT = 'product'
    MACHINE_ENDPOINT = 'machine'
    MACHINE_PLATFORM_ENDPOINT = 'machineplatform'
    FAILURE_CLASSIFICATION_ENDPOINT = 'failureclassification'
    BUILD_PLATFORM_ENDPOINT = 'buildplatform'
    MAX_COUNT = 2000

    def __init__(
            self, protocol='https', host='treeherder.mozilla.org',
            timeout=120, client_id=None, secret=None):
        """
        :param protocol: protocol to use (http or https)
        :param host: treeherder host to post to
        :param timeout: maximum time it can take for a request to complete
        :param client_id: the Treeherder API credentials client ID
        :param secret: the Treeherder API credentials secret
        """
        self.host = host

        if protocol not in self.PROTOCOLS:
            raise AssertionError('Protocol "%s" not supported; please use one '
                                 'of %s' % (protocol,
                                            ', '.join(self.PROTOCOLS)))
        self.protocol = protocol
        self.timeout = timeout

        # Using a session gives us automatic keep-alive/connection pooling.
        self.session = requests.Session()
        self.session.headers.update(self.REQUEST_HEADERS)

        if client_id and secret:
            self.auth = HawkAuth(id=client_id, key=secret)
        else:
            self.auth = None

    def _get_project_uri(self, project, endpoint):

        return '{0}://{1}/api/project/{2}/{3}/'.format(
            self.protocol, self.host, project, endpoint
            )

    def _get_uri(self, endpoint):
        uri = '{0}://{1}/api/{2}/'.format(
            self.protocol, self.host, endpoint)

        return uri

    def _get_json_list(self, endpoint, timeout,  project=None, **params):
        if "count" in params and (params["count"] is None or params["count"] > self.MAX_COUNT):
            total = None if params["count"] is None else params["count"]
            count = self.MAX_COUNT
            offset = 0
            data = []
            while True:
                params["count"] = count
                params["offset"] = offset
                new_data = self._get_json(endpoint, timeout, project=project, **params)["results"]
                data += new_data
                if len(new_data) < self.MAX_COUNT:
                    return data
                offset += count
                if total is not None:
                    count = min(total-offset, self.MAX_COUNT)
        else:
            return self._get_json(endpoint, timeout, project=project, **params)["results"]

    def _get_json(self, endpoint, timeout, project=None, **params):
        if timeout is None:
            timeout = self.timeout

        if project is None:
            uri = self._get_uri(endpoint)
        else:
            uri = self._get_project_uri(project, endpoint)

        resp = self.session.get(uri, params=params, timeout=timeout)
        try:
            resp.raise_for_status()
        except HTTPError:
            logger.error("HTTPError %s requesting %s: %s",
                         resp.status_code, resp.request.url, resp.content)
            logger.debug("Request headers: %s", resp.request.headers)
            logger.debug("Response headers: %s", resp.headers)
            raise

        return resp.json()

    def _post_json(self, project, endpoint, data, timeout):
        if timeout is None:
            timeout = self.timeout

        uri = self._get_project_uri(project, endpoint)

        resp = self.session.post(uri, json=data, timeout=timeout, auth=self.auth)

        try:
            resp.raise_for_status()
            return resp
        except HTTPError:
            logger.error("HTTPError %s submitting to %s: %s",
                         resp.status_code, resp.request.url, resp.content)
            logger.debug("Request headers: %s", resp.request.headers)
            logger.debug("Request body: %s", resp.request.body)
            logger.debug("Response headers: %s", resp.headers)
            raise

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
        resp = self._get_json(self.OPTION_COLLECTION_HASH_ENDPOINT, None)
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
        return self._get_json(self.REPOSITORY_ENDPOINT, None)

    def get_products(self):
        """
        Get a list of treeherder products.

        Returns a list with the following structure:

            {
              id: <id>,
              name: <name>,
              description: <description>,
              active_status: <active_status>
            }
        """
        return self._get_json(self.PRODUCT_ENDPOINT, None)

    def get_job_groups(self):
        """
        Gets a list of job groups stored inside Treeherder

        Returns a list of dictionaries with the following properties:

            {
              id: <id>,
              symbol: <symbol>,
              name: <name>
              ...
            }
        """
        return self._get_json(self.JOBGROUP_ENDPOINT, None)

    def get_failure_classifications(self):
        """
        Gets a list of failure classification types stored inside Treeherder

        Returns a list of dictionaries with the following properties:

            {
              id: <id>,
              name: <name>,
              description: <description>,
              active_status: <active_status>
            }
        """
        return self._get_json(self.FAILURE_CLASSIFICATION_ENDPOINT, None)

    def get_build_platforms(self):
        """
        Gets a list of build platforms stored inside Treeherder

        Returns a list of dictionaries with the following properties:

            {
              id: <id>,
              os_name: <os_name>,
              platform: <platform>,
              architecture: <architecture>
              active_status: <active_status>
            }
        """
        return self._get_json(self.BUILD_PLATFORM_ENDPOINT, None)

    def get_job_types(self):
        """
        Gets a list of job types stored inside Treeherder

        Returns a list of dictionaries with the following properties:

            {
              id: <id>
              job_group: <job_group_id>
              symbol: <symbol>
              name: <name>
              ...
            }
        """
        return self._get_json(self.JOBTYPE_ENDPOINT, None)

    def get_machines(self):
        """
        Gets a list of machines stored inside Treeherder

        Returns a list of dictionaries with the following properties:

            {
              id: <id>,
              name: <name>,
              first_timestamp: <first_timestamp>,
              last_timestamp: <last_timestamp>,
              active_status: <active_status>
            }
        """
        return self._get_json(self.MACHINE_ENDPOINT, None)

    def get_machine_platforms(self):
        """
        Gets a list of machine platforms stored inside Treeherder

        Returns a list of dictionaries with the following properties:

            {
              id: <id>
              os_name: <os_name>
              platform: <platform>,
              architecture: <architecture>,
              active_status: <active_status>
            }
        """
        return self._get_json(self.MACHINE_PLATFORM_ENDPOINT, None)

    def get_resultsets(self, project, **params):
        """
        Gets resultsets from project, filtered by parameters

        By default this method will just return the latest 10 result sets (if they exist)

        :param project: project (repository name) to query data for
        :param params: keyword arguments to filter results
        """
        return self._get_json_list(self.RESULTSET_ENDPOINT, None, project, **params)

    def get_jobs(self, project, **params):
        """
        Gets jobs from project, filtered by parameters

        :param project: project (repository name) to query data for
        :param params: keyword arguments to filter results
        """
        return self._get_json_list(self.JOBS_ENDPOINT, None, project, **params)

    def get_job_log_url(self, project, **params):
        """
        Gets job log url, filtered by parameters

        :param project: project (repository name) to query data for
        :param params: keyword arguments to filter results
        """
        return self._get_json(self.JOB_LOG_URL_ENDPOINT, None, project,
                              **params)

    def get_artifacts(self, project, **params):
        """
        Gets artifact list from project, filtered by parameters

        :param project: project (repository name) to query for
        :param params: keyword arguments to filter results
        """
        response = self._get_json(self.ARTIFACTS_ENDPOINT, None, project, **params)
        return response

    def post_collection(self, project, collection_inst, timeout=None):
        """
        Sends a treeherder collection to the server

        :param project: project to submit data for
        :param collection_inst: a TreeherderCollection instance
        :param timeout: custom timeout in seconds (defaults to class timeout)
        """
        if not isinstance(collection_inst, TreeherderCollection):
            msg = '{0} should be an instance of TreeherderCollection'.format(
                type(collection_inst))
            raise TreeherderClientError(msg, [])

        if not collection_inst.endpoint_base:
            msg = "{0}: collection endpoint_base property not defined".format(
                self.__class__.__name__)
            raise TreeherderClientError(msg, [])

        if not collection_inst.data:
            msg = "{0}: collection data property not defined".format(
                self.__class__.__name__)
            raise TreeherderClientError(msg, [])

        collection_inst.validate()

        return self._post_json(project, collection_inst.endpoint_base,
                               collection_inst.get_collection_data(), timeout)


class TreeherderClientError(Exception):
    def __init__(self, msg, Errors):
        Exception.__init__(self, msg)
        self.Errors = Errors
