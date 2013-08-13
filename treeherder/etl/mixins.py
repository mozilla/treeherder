from StringIO import StringIO
import gzip
import urllib2
import logging

import simplejson as json

from django.core.urlresolvers import reverse
from django.conf import settings

logger = logging.getLogger()


class JsonExtractorMixin(object):
    def extract(self, url):
        """
        Deserializes a json string contained a given file, uncompressing it if needed
        """
        response = urllib2.urlopen(url)
        if response.info().get('Content-Encoding') == 'gzip':
            buf = StringIO(response.read())
            f = gzip.GzipFile(fileobj=buf)
            return f.read()
        return json.loads(response.read())


class JsonLoaderMixin(object):
    """This mixin posts a json serializable object to the given url"""
    def load(self, url, data):
        req = urllib2.Request(url)
        req.add_header('Content-Type', 'application/json')
        return urllib2.urlopen(req, json.dumps(data))


class JobsLoaderMixin(JsonLoaderMixin):

    def load(self, jobs):
        """post a list of jobs to the objectstore ingestion endpoint """

        for job in jobs:
            project = job['sources'][0]['repository']

            # the creation endpoint is the same as the list one
            endpoint = reverse('objectstore-list', kwargs={"project": project})

            url = "{0}/{1}/".format(
                settings.API_HOSTNAME.strip('/'),
                endpoint.strip('/')
            )
            response = super(JobsLoaderMixin, self).load(url, job)

            if response.getcode() != 200:
                message = json.loads(response.read())
                logger.ERROR("Job loading failed: {0}".format(message['message']))
