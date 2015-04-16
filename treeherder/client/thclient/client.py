# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
from __future__ import unicode_literals

import httplib
import oauth2 as oauth
import time
import logging

logger = logging.getLogger(__name__)

import json

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
                'type':optional, some data type, required type of property value
                'cb': some function reference, called with
                      list of keys, list of values, required_properties key
            }

        Example:

            self.required_properties = {
                'revision_hash':{
                    'len':50, 'cb':self.validate_existence
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
            property_errors += '\tThe required Property, {0}, is missing\n'.format(
                '.'.join(missing_keys))

        if not v:
            property_errors += '\tValue not defined for {0}\n'.format(property_key)
        else:
            if ('type' in values) and (not isinstance(v, values['type'])):
                property_errors += '\tThe value type, {0}, should be {1}\n'.format(
                    type(v), values['type'])

        max_limit = values.get('len', None)
        if v and max_limit and (len(v) > max_limit):
            property_errors += '\tValue length exceeds maximum {0} char limit: {1}\n'.format(
                str(max_limit), str(v))

        if property_errors:

            msg = '{0} structure validation errors detected for property:{1}\n{2}\n{3}\n'.format(
                self.__class__.__name__, property_key, property_errors, json.dumps(self.data))

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

    def __init__(self, data={}):

        super(TreeherderJob, self).__init__(data)

        # Provide minimal json structure validation
        self.required_properties = {
            'revision_hash':{ 'len':50, 'cb':self.validate_existence },
            'project':{ 'cb':self.validate_existence },
            'job':{ 'type':dict, 'cb':self.validate_existence },
            'job.job_guid':{ 'len':50, 'cb':self.validate_existence }
            }

    def add_revision_hash(self, revision_hash):
        self.data['revision_hash'] = revision_hash

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

    def add_build_url(self, url):
        self.data['job']['build_url'] = url

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

    def add_log_reference(self, name, url):
        if name and url:
            self.data['job']['log_references'].append(
                { 'url':url, 'name':name }
                )

    def add_artifact(self, name, artifact_type, blob):
        if blob:
            self.data['job']['artifacts'].append({
                'name': name,
                'type': artifact_type,
                'blob': blob
            })

    def init_data(self):

        self.data = {

            'revision_hash': '',

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

                # Stored in project_jobs_1.job_artifact, name=build_url
                'build_url': '',

                # Stored in
                # treeherder_reference_1.build_platform.os_name,
                # treeherder_reference_1.build_platform.platform,
                # treeherder_reference_1.build_platform.architecture,
                'build_platform':{
                    'os_name': '', 'platform': '', 'architecture': '' },

                # Stored in:
                # treeherder_reference_1.machine_platform.os_name,
                # treeherder_reference_1.machine_platform.platform,
                # treeherder_reference_1.machine_platform.architecture,
                'machine_platform':{
                    'os_name': '', 'platform': '', 'architecture': '' },

                # Stored in treeherder_reference_1.option_collection and
                # treeherder_reference_1.option
                # Ex: 'debug | pgo | asan | opt': True
                'option_collection': { },

                # Stored in project_jobs_1.job_log_url
                # Example:
                # log_references: [
                #    { url:'http://ftp.mozilla.org/pub/mozilla.org/firefox..gz',
                #      name:'unittest' },
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
        'coalesced': [ ]
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
            'revision':{ 'len':50, 'cb':self.validate_existence },
            'repository':{ 'cb':self.validate_existence },
            'files':{ 'type':list, 'cb':self.validate_existence },
            }

    def init_data(self):

        self.data = {
            # Stored in project_jobs_1.revision.author
            'author': '',
            # Stored in project_jobs_1.revision.comments
            'comment': '',
            # Stored in project_jobs_1.revision.files
            'files': [],
            # Stored in treeherder_reference_1.repository.name
            'repository': '',
            # Stored in project_jobs_1.revision.revision
            'revision': '',
            }

    def add_author(self, author):
        self.data['author'] = author

    def add_comment(self, comment):
        self.data['comment'] = comment

    def add_files(self, files):
        if files:
            self.data['files'] = files

    def add_file(self, src_file):
        if src_file:
            self.data['files'].append(src_file)

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
            'revision_hash':{ 'len':50, 'cb':self.validate_existence },
            'revisions':{ 'type':list, 'cb':self.validate_existence },
            'author':{ 'len':150, 'cb':self.validate_existence }
            }

    def init_data(self):

        self.data = {
            # Stored in project_jobs_1.result_set.push_timestamp
            'push_timestamp': None,
            # Stored in project_jobs_1.result_set.revision_hash
            'revision_hash': '',
            # Stored in project_jobs_1.result_set.author
            'author': '',
            # Stored in project_jobs_1.revision, new row per revision
            'revisions': [],
            # TODO: add type column to resultset in treeherder-service
            'type': '',
            # TODO: add resultset artifact table in treeherder-service
            'artifact': {
                'name': "",
                'type': "",
                'blob': ""
            }
        }

    def add_push_timestamp(self, push_timestamp):
        self.data['push_timestamp'] = push_timestamp

    def add_revision_hash(self, revision_hash):
        self.data['revision_hash'] = revision_hash

    def add_author(self, author):
        self.data['author'] = author

    def add_revisions(self, revisions):
        if revisions:
            self.data['revisions'] = revisions

    def add_revision(self, revision):
        if revision:

            revision.validate()

            self.data['revisions'].append(revision.data)

    def add_type(self, resultset_type):
        self.data['type'] = resultset_type

    def add_artifact(self, name, artifact_type, blob):
        if blob:
            self.data['artifact'] = {
                'name': name,
                'type': artifact_type,
                'blob': blob
            }

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

    def __init__(self, data=[]):

        self.data = []

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
        return json.dumps( self.get_collection_data() )

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

class TreeherderJobCollection(TreeherderCollection):
    """
    Collection of job objects
    """

    def __init__(self, data=[], job_type=''):

        super(TreeherderJobCollection, self).__init__(data)

        if job_type == 'update':
            self.endpoint_base = 'jobs'
        else:
            self.endpoint_base = 'objectstore'

    def get_job(self, data={}):

        return TreeherderJob(data)

class TreeherderResultSetCollection(TreeherderCollection):
    """
    Collection of result set objects
    """

    def __init__(self, data=[]):

        super(TreeherderResultSetCollection, self).__init__(data)

        self.endpoint_base = 'resultset'

    def get_resultset(self, data={}):

        return TreeherderResultSet(data)

class TreeherderArtifactCollection(TreeherderCollection):
    """
    Collection of job artifacts
    """

    def __init__(self, data=[]):

        super(TreeherderArtifactCollection, self).__init__(data)

        self.endpoint_base = 'artifact'

    def get_artifact(self, data={}):

        return TreeherderArtifact(data)


class OauthClient(object):
    """
    A utility class containing the logic to sign a oauth request
    """
    def __init__(self, oauth_key, oauth_secret, user):
        self.oauth_key = oauth_key
        self.oauth_secret = oauth_secret
        self.user = user

    def get_signed_uri(self, serialized_body, uri, http_method):

        # There is no requirement for the token in two-legged
        # OAuth but we still need the token object.
        token = oauth.Token(key='', secret='')
        consumer = oauth.Consumer(key=self.oauth_key, secret=self.oauth_secret)

        parameters = {
            'user': self.user,
            'oauth_version': '1.0',
            'oauth_nonce': oauth.generate_nonce(),
            'oauth_timestamp': int(time.time())
        }

        try:
            req = oauth.Request(
                method=http_method,
                body=serialized_body,
                url=uri,
                parameters=parameters
            )
        except AssertionError, e:
            logger.error('uri: %s' % uri)
            logger.error('body: %s' % serialized_body)
            raise

        signature_method = oauth.SignatureMethod_HMAC_SHA1()
        req.sign_request(signature_method, consumer, token)

        return req.to_url()


class TreeherderRequest(object):
    """
    Treeherder request object that manages test submission.
    """

    protocols = set(['http', 'https']) # supported protocols

    def __init__(
        self, protocol='', host='', project='', oauth_key='',
        oauth_secret='', timeout=120):
        """
        - host : treeherder host to post to
        - project : name of the project in treeherder
        - oauth_key, oauth_secret : oauth credentials
        - timeout : maximum timeout for requests
        """
        self.host = host
        self.project = project
        self.oauth_key = oauth_key
        self.oauth_secret = oauth_secret
        self.use_oauth = bool(self.oauth_key and self.oauth_secret)
        self.oauth_client = None
        if self.use_oauth:
            self.oauth_client = OauthClient(oauth_key, oauth_secret, self.project)

        if protocol not in self.protocols:
            raise AssertionError('Protocol "%s" not supported; please use one of %s' %
                                 (protocol, ', '.join(self.protocols)))
        self.protocol = protocol
        self.timeout = timeout

        # ensure the required parameters are given
        if not self.project:
            msg = "{0}: project required for posting".format(self.__class__.__name__)
            raise TreeherderClientError(msg, [])

    def post(self, collection_inst):
        """Shortcut method to send a treeherder collection via POST

        :param collection_inst: a TreeherderCollection instance
        :returns: an httplib Response object
        """

        if not isinstance(collection_inst, TreeherderCollection):

            msg = '{0} should be an instance of TreeherderCollection'.format(type(collection_inst))

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

        return self.send(collection_inst.endpoint_base,
                         method="POST",
                         data=collection_inst.to_json())

    def send(self, endpoint, method=None, data=None):
        """send data to the given endpoint with the given http method.

        :param endpoint: the target endpoint for this request
        :param method: can be one of GET,POST,PUT
        :param data: the body of this request
        :returns: an httplib Response object
        """

        if method not in ("GET", "POST", "PUT"):
            msg = "{0}: {1} is not a supported method".format(
                self.__class__.__name__,
                method
            )
            raise TreeherderClientError(msg, [])

        # Build the header
        headers = {'Content-Type': 'application/json'}

        if data:
            if not isinstance(data, str):
                # if the body is not serialized yet, do it now
                serialized_body = json.dumps(data)
            else:
                serialized_body = data
        else:
            serialized_body = None

        uri = self.get_uri(endpoint)

        if self.use_oauth:
            uri = self.oauth_client.get_signed_uri(serialized_body, uri, method)

        # Make the request
        conn = None
        if self.protocol == 'http':
            conn = httplib.HTTPConnection(self.host, timeout=self.timeout)
        else:
            conn = httplib.HTTPSConnection(self.host, timeout=self.timeout)

        conn.request(method, uri, serialized_body, headers)

        return conn.getresponse()

    def get_uri(self, endpoint):

        uri = '{0}://{1}/api/project/{2}/{3}/'.format(
            self.protocol, self.host, self.project, endpoint
            )

        return uri


class TreeherderClientError(Exception):
    def __init__(self, msg, Errors):
        Exception.__init__(self, msg)
        self.Errors = Errors
