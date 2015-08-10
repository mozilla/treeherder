import gzip
import logging
import urllib2
from StringIO import StringIO

import simplejson as json
from django.conf import settings
from django.core.urlresolvers import reverse

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
        if th_collections:
            th_publisher.post_treeherder_collections(th_collections, chunk_size)
