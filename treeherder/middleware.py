import re

import newrelic.agent
from django.utils.deprecation import MiddlewareMixin
from hawkrest.middleware import HawkResponseMiddleware
from whitenoise.middleware import WhiteNoiseMiddleware


class CustomWhiteNoise(WhiteNoiseMiddleware):
    """Sets long max-age headers for webpack generated files."""

    # Matches webpack's style of chunk filenames. eg:
    # index.f03882a6258f16fceb70.bundle.js
    IMMUTABLE_FILE_RE = re.compile(r'\.[a-f0-9]{16,}\.bundle\.(js|css)$')

    def immutable_file_test(self, path, url):
        """Support webpack bundle filenames when setting long max-age headers."""
        if self.IMMUTABLE_FILE_RE.search(url):
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


class FixedHawkResponseMiddleware(MiddlewareMixin, HawkResponseMiddleware):
    """
    Makes HawkResponseMiddleware compatible with Django's new middleware API.

    Remove when `MiddlewareMixin` has been added upstream:
    https://github.com/kumar303/hawkrest/issues/38
    """
    pass
