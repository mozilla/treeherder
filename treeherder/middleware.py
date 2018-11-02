import re

import newrelic.agent
from django.utils.deprecation import MiddlewareMixin
from whitenoise.middleware import WhiteNoiseMiddleware


class CustomWhiteNoise(WhiteNoiseMiddleware):
    """Sets long max-age headers for Neutrino-generated hashed files."""

    # Matches Neutrino's style of hashed filename URLs, eg:
    #   /assets/index.1d85033a.js
    #   /assets/2.379789df.css.map
    #   /assets/fontawesome-webfont.af7ae505.woff2
    IMMUTABLE_FILE_RE = re.compile(r'^/assets/.*\.[a-f0-9]{8}\..*')

    def immutable_file_test(self, path, url):
        """
        Determines whether the given URL represents an immutable file (i.e. a file with a
        hash of its contents as part of its name) which can therefore be cached forever.
        """
        if self.IMMUTABLE_FILE_RE.match(url):
            return True
        # Otherwise fall back to the default method, so we catch filenames in the
        # style output by GzipManifestStaticFilesStorage during collectstatic. eg:
        #   bootstrap.min.abda843684d0.js
        return super(CustomWhiteNoise, self).immutable_file_test(path, url)


class NewRelicMiddleware(MiddlewareMixin):
    """Adds custom annotations to New Relic web transactions."""

    def process_request(self, request):
        # The New Relic Python agent only submits the User Agent to APM (for exceptions and
        # slow transactions), so for use in Insights we have to add it as a customer parameter.
        if 'HTTP_USER_AGENT' in request.META:
            newrelic.agent.add_custom_parameter('user_agent', request.META['HTTP_USER_AGENT'])
