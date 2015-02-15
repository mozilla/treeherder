from rest_framework import throttling


class OauthKeyThrottle(throttling.ScopedRateThrottle):

    def get_cache_key(self, request, view):
        """
        If `view.throttle_scope` is not set, don't apply this throttle.
        Otherwise generate the unique cache key by concatenating the oauth key
        with the '.throttle_scope` property of the view.
        """
        ident = request.GET.get('oauth_consumer_key', None)
        if not ident:
            return None
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }
