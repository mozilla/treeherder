# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import httplib
import oauth2 as oauth
import time
import urllib

try:
    import json
except ImportError:
    import simplejson as json

class ValidatorMixin(object):

    def validate(self, required_properties={}):
        """
        Implement job object validation rules. If a rule fails raise
        TreeherderClientError
        """

        required_properties = required_properties or self.required_properties

        for prop in required_properties:

            cb = required_properties[prop]['cb']

            cb(prop.split('.'), required_properties[prop], prop)

    def validate_existence(self, keys, props, property_key):

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
            if not isinstance(v, props['type']):
                property_errors += '\tThe value type, {0}, should be {1}\n'.format(
                    type(v), props['type'])

        max_limit = props['len']
        if v and max_limit and (len(v) > max_limit):
            property_errors += '\tValue length exceeds maximum {0} char limit: {1}\n'.format(
                str(max_limit), str(v))

        if property_errors:

            msg = '{0} structure validation errors detected for property:{1}\n{2}\n{3}\n'.format(
                self.__class__.__name__, property_key, property_errors, json.dumps(self.data))

            raise TreeherderClientError(msg, [])

class TreeherderJob(ValidatorMixin):

    def __init__(self, data={}):

        self.data = {}

        if data:
            self.data = data
        else:
            self.init_empty_job()

        # Provide minimal json structure validation
        self.required_properties = {
            'revision_hash':{ 'len':50, 'type':unicode, 'cb':self.validate_existence },
            'project':{ 'len':None, 'type':unicode, 'cb':self.validate_existence },
            'job':{ 'len':None, 'type':dict, 'cb':self.validate_existence },
            'job.job_guid':{ 'len':50, 'type':unicode, 'cb':self.validate_existence }
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

    def add_option_collection(self, collection):
        if collection:
            self.data['job']['option_collection'].update(collection)

    def add_log_reference(self, name, url):
        if name and url:
            self.data['job']['log_references'].append(
                { 'url':url, 'name':name }
                )

    def add_artifact(self, name, artifact_type, blob):
        if blob:
            self.data['job']['artifact'] = {
                    'name': name,
                    'type': artifact_type,
                    'blob': blob
                }

    def init_empty_job(self):

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
                'artifact': {
                    'name': '',
                    'type': '',
                    'blob': ''
                    }
            },

        # List of job_guids that were coallesced to this job
        # Stored in project_jobs_1.job.coalesced_job_guid
        # Where the value of coalesced_job_guid is set to job_guid
        # for the list of job_guids provided in coalesced
        'coalesced': [ ]
            }

    def to_json(self):
        return json.dumps(self.data)

class TreeherderJobCollection(object):

    def __init__(self, data=[]):

        self.data = []

        self.endpoint_base = 'objectstore'

        if data:
            self.data = data

    def add(self, job):

        job.validate()
        self.data.append(job.data)

    def to_json(self):

        return json.dumps(self.data)

    def get_job(self, data={}):
        return TreeherderJob(data)

class TreeherderRevision(ValidatorMixin):

    def __init__(self, data={}):

        self.data = {}

        if data:
            self.data = data
        else:
            self.init_empty_revision()

        # Provide minimal json structure validation
        self.required_properties = {
            'revision':{ 'len':50, 'type':unicode, 'cb':self.validate_existence },
            'repository':{ 'len':None, 'type':unicode, 'cb':self.validate_existence },
            'files':{ 'len':None, 'type':list, 'cb':self.validate_existence },
            }

    def init_empty_revision(self):

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

class TreeherderResultSet(ValidatorMixin):

    def __init__(self, data={}):

        self.data = {}

        if data:
            self.data = data
        else:
            self.init_empty_result_set()

        self.required_properties = {
            'revision_hash':{ 'len':50, 'type':unicode, 'cb':self.validate_existence },
            'revisions':{ 'len':None, 'type':list, 'cb':self.validate_existence },
            }

    def init_empty_result_set(self):

        self.data = {
            # Stored in project_jobs_1.result_set.push_timestamp
            'push_timestamp': None,
            # Stored in project_jobs_1.result_set.revision_hash
            'revision_hash': '',
            # Stored in project_jobs_1.revision, new row per revision
            'revisions': [],
            # TODO: add type column to resultset in treeherder-service
            'type': '',
            # TODO: add resultset artifact table in treeherder-service
            'artifact': {
                'type': '',
                'name': '',
                'blob': ''
                }
            }

    def add_push_timestamp(self, push_timestamp):
        self.data['push_timestamp'] = push_timestamp

    def add_revision_hash(self, revision_hash):
        self.data['revision_hash'] = revision_hash

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

class TreeherderResultSetCollection(object):

    def __init__(self, data=[]):

        self.data = []

        self.endpoint_base = 'resultset'

        if data:
            self.data = data

    def add(self, resultset):
        resultset.validate()
        self.data.append(resultset.data)

    def get_resultset(self, data={}):
        return TreeherderResultSet(data)

    def to_json(self):
        return json.dumps(self.data)

class TreeherderRequest(object):
    """
    Treeherder request object that manages test submission.
    """

    protocols = set(['http', 'https']) # supported protocols

    def __init__(
        self, protocol='', host='', project='', oauth_key='',
        oauth_secret=''):
        """
        - host : treeherder host to post to
        - project : name of the project in treeherder
        - oauth_key, oauth_secret : oauth credentials
        """
        self.host = host
        self.project = project
        self.oauth_key = oauth_key
        self.oauth_secret = oauth_secret

        if protocol not in self.protocols:
            raise AssertionError('Protocol "%s" not supported; please use one of %s' %
                                 (protocol, ', '.join(self.protocols)))
        self.protocol = protocol

        # ensure the required parameters are given
        assert self.project, "{0}: project required for posting".format(self.__class__.__name__)

    def send(self, collection):
        "Send given treeherder collection to server; returns httplib Response."""

        assert collection.endpoint_base, "{0}: collection endpoint_base property not defined".format(
                self.__class__.__name__)

        assert collection.data, "{0}: collection data property not defined".format(
                self.__class__.__name__)

        uri = self.get_uri(collection)

        params = {
            'data':urllib.quote(collection.to_json())
            }

        use_oauth = bool(self.oauth_key and self.oauth_secret)
        if use_oauth:

            params.update({'user': self.project,
                           'oauth_version': '1.0',
                           'oauth_nonce': oauth.generate_nonce(),
                           'oauth_timestamp': int(time.time())})

            # There is no requirement for the token in two-legged
            # OAuth but we still need the token object.
            token = oauth.Token(key='', secret='')
            consumer = oauth.Consumer(key=self.oauth_key, secret=self.oauth_secret)

            params['oauth_token'] = token.key
            params['oauth_consumer_key'] = consumer.key

            try:
                req = oauth.Request(method='POST', url=uri, parameters=params)
            except AssertionError, e:
                print 'uri: %s' % uri
                print 'params: %s' % params
                raise

            # Set the signature
            signature_method = oauth.SignatureMethod_HMAC_SHA1()

            # Sign the request
            req.sign_request(signature_method, consumer, token)
            body = req.to_postdata()
        else:
            body = urllib.urlencode(params)

        # Build the header
        header = {'Content-type': 'application/json'}

        # Make the POST request
        conn = None
        if self.protocol == 'http':
            conn = httplib.HTTPConnection(self.host)
        else:
            conn = httplib.HTTPSConnection(self.host)

        conn.request('POST', uri, body, header)
        return conn.getresponse()

    def get_uri(self, collection):

        uri = '{0}://{1}/api/project/{2}/{3}/'.format(
            self.protocol, self.host, self.project, collection.endpoint_base
            )

        return uri

class TreeherderClientError(Exception):
    def __init__(self, msg, Errors):
        Exception.__init__(self, msg)
        self.Errors = Errors
