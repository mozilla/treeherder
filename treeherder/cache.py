# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.cache.backends import memcached


class MemcachedCache(memcached.MemcachedCache):

    """
A subclass of Django's built-in Memcached backend that fixes some issues.

- Allows caching forever with a timeout of 0.
- Returns the return value of set() to allow for error-checking.

"""

    def _get_memcache_timeout(self, timeout):
        if timeout is None:
            timeout = self.default_timeout
        if not timeout:
            return 0
        return super(MemcachedCache, self)._get_memcache_timeout(timeout)

    def set(self, key, value, timeout=0, version=None):
        key = self.make_key(key, version=version)
        return self._cache.set(key, value, self._get_memcache_timeout(timeout))
