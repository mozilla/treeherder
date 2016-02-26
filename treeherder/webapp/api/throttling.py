from rest_framework import throttling


class HawkClientThrottle(throttling.ScopedRateThrottle):

    def get_cache_key(self, request, view):
        """
        Returns a cache_key based on the hawk Client ID.

        If `view.throttle_scope` is not set or request.META['hawk.receiver'] is not set,
        don't apply this throttle. Otherwise generate the unique cache key by
        concatenating the client_id with the '.throttle_scope` property of the view.
        """
        receiver = request.META.get('hawk.receiver')
        if receiver is None:
            return None
        client_id = receiver.parsed_header['id']
        return self.cache_format % {
            'scope': self.scope,
            'ident': client_id
        }
