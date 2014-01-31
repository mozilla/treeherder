from StringIO import StringIO
import gzip
import urllib2
import logging
from collections import defaultdict

import simplejson as json

from thclient import TreeherderRequest, TreeherderJobCollection, TreeherderResultSetCollection, TreeherderClientError

from treeherder.model.derived.base import TreeherderModelBase

from django.core.urlresolvers import reverse
from django.conf import settings

logger = logging.getLogger(__name__)


class JsonExtractorMixin(object):
    def extract(self, url):
        """
        Deserializes a json string contained a given file, uncompressing it if needed
        """
        req = urllib2.Request(url)
        req.add_header('Accept', 'application/json')
        req.add_header('Content-Type', 'application/json')
        try:
            handler = urllib2.urlopen(req)
            if handler.info().get('Content-Encoding') == 'gzip':
                buf = StringIO(handler.read())
                handler = gzip.GzipFile(fileobj=buf)
            return json.loads(handler.read())
        except Exception, e:
            logger.error('Error fetching {0}'.format(url), exc_info=True)
            return None


class JsonLoaderMixin(object):
    """This mixin posts a json serializable object to the given url"""
    def load(self, url, data):
        req = urllib2.Request(url)
        req.add_header('Content-Type', 'application/json')
        if not data:
            data = None
        return urllib2.urlopen(req, json.dumps(data))


class ObjectstoreLoaderMixin(JsonLoaderMixin):

    def load(self, jobs):
        """post a list of jobs to the objectstore ingestion endpoint """

        # group the jobs by project
        projects = defaultdict(list)
        for job in jobs:
            projects[job['project']].append(job)

        for project, jobs in projects.items():
            endpoint = reverse('objectstore-list', kwargs={"project": project})

            url = "{0}/{1}/".format(
                settings.API_HOSTNAME.strip('/'),
                endpoint.strip('/')
            )
            print ['ObjectstoreLoaderMixin', url]
            response = super(ObjectstoreLoaderMixin, self).load(url, jobs)

            if response.getcode() != 200:
                message = json.loads(response.read())
                logger.error("Job loading failed: {0}".format(message['message']))


class ResultSetsLoaderMixin(JsonLoaderMixin):

    def load(self, result_sets, project):
        """
        post a list of result sets to the result set ingestion endpoint
        [
            {
                "push_timestamp": 12345678,
                "revision_hash": "d62d628d5308f2b9ee81be755140d77f566bb400",
                "revisions": [
                    {
                        "id": "d62d628d5308f2b9ee81be755140d77f566bb400",
                        "files": [
                            "file1",
                            "file2",
                            "file3"
                        ],
                        "author": "Mauro Doglio <mdoglio@mozilla.com>",
                        "branch": "default",
                        "comment":" Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                        "repository": null
                    }
                ]
            }
        ]
        """
        if result_sets:

            endpoint = reverse('resultset-list', kwargs={"project": project})

            url = "{0}/{1}/".format(
                settings.API_HOSTNAME.strip('/'),
                endpoint.strip('/')
                )
            response = super(ResultSetsLoaderMixin, self).load(url, result_sets)

            if not response or response.getcode() != 200:
                message = json.loads(response.read())
                logger.error("ResultSet loading failed: {0}".format(message['message']))

class OAuthLoaderMixin(object):

    credentials = {}

    param_keys = set([
        'oauth_body_hash',
        'oauth_signature',
        'oauth_consumer_key',
        'oauth_nonce',
        'oauth_timestamp',
        'oauth_signature_method',
        'oauth_version',
        'oauth_token',
        'user'
        ])

    @classmethod
    def get_parameters(cls, query_params):
        parameters = {}
        for key in cls.param_keys:
            parameters[key] = query_params.get(key, None)
        return parameters

    @classmethod
    def set_credentials(cls, credentials={}):
        # Only get the credentials once
        if not cls.credentials and not credentials:
            cls.credentials = TreeherderModelBase.get_oauth_credentials()
        else:
            cls.credentials = credentials

    @classmethod
    def get_credentials(cls, project):
        return cls.credentials.get(project, {})

    @classmethod
    def get_consumer_secret(cls, project):
        return cls.credentials.get(project, {})

    @classmethod
    def validate_credentials(cls, project, key, secret):

        project_credentials = cls.credentials.get(project, {})

        valid = False
        if project_credentials:

            if (project_credentials['consumer_key'] == key) and \
               (project_credentials['consumer_secret'] == secret):

                valid = True

        return valid

    def load(self, th_collections):

        for project in th_collections:

            credentials = OAuthLoaderMixin.get_credentials(project)

            th_request = TreeherderRequest(
                protocol=settings.TREEHERDER_REQUEST_PROTOCOL,
                host=settings.TREEHERDER_REQUEST_HOST,
                project=project,
                oauth_key=credentials['consumer_key'],
                oauth_secret=credentials['consumer_secret']
                )

            response = th_request.send( th_collections[project] )

            if not response or response.status != 200:
                message = response.read()
                logger.error("collection loading failed: {0}".format(message))
                print "collection loading failed: {0}".format(message)


if not OAuthLoaderMixin.credentials:
    # Only set the credentials once
    OAuthLoaderMixin.set_credentials()
