# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from StringIO import StringIO
import gzip
import urllib2
import logging
from collections import defaultdict

import simplejson as json

from django.core.urlresolvers import reverse
from django.conf import settings

from treeherder.etl import th_publisher


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
            handler = urllib2.urlopen(req, timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)
            encoding = handler.info().get('Content-Encoding')
            if encoding and 'gzip' in encoding:
                buf = StringIO(handler.read())
                handler = gzip.GzipFile(fileobj=buf)

            return json.loads(handler.read())
        except Exception:
            logger.error('Error fetching {0}'.format(url), exc_info=True)
            return None


class JsonLoaderMixin(object):

    """This mixin posts a json serializable object to the given url"""

    def load(self, url, data):
        req = urllib2.Request(url)
        req.add_header('Content-Type', 'application/json')
        if not data:
            data = None
        return urllib2.urlopen(req, json.dumps(data),  timeout=settings.TREEHERDER_REQUESTS_TIMEOUT)


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

    def load(self, th_collections, chunk_size=1):
        th_publisher.post_treeherder_collections(th_collections, chunk_size)
