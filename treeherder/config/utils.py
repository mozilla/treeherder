from six.moves.urllib.parse import urlparse


def hostname(url):
    return urlparse(url).hostname


def connection_should_use_tls(url):
    # Services such as RabbitMQ/Elasticsearch running on Travis do not yet have TLS
    # certificates set up. We could try using TLS locally using self-signed certs,
    # but until Travis has support it's not overly useful.
    return hostname(url) != 'localhost'


def get_tls_redis_url(redis_url):
    """
    Returns the TLS version of a Heroku REDIS_URL string.

    Whilst Redis server (like memcached) doesn't natively support TLS, Heroku runs an stunnel
    daemon on their Redis instances, which can be connected to directly by Redis clients that
    support TLS (avoiding the need for stunnel on the client). The stunnel port is one higher
    than the Redis server port, and the informal `rediss://` scheme used to instruct clients
    to wrap the connection with TLS.

    Will convert 'redis://h:PASSWORD@INSTANCE.compute-1.amazonaws.com:8409'
          ...to: 'rediss://h:PASSWORD@INSTANCE.compute-1.amazonaws.com:8410'

    See:
    https://devcenter.heroku.com/articles/securing-heroku-redis#connecting-directly-to-stunnel
    """
    parsed_url = urlparse(redis_url)
    # The parsed URL's `port` property is read-only, so the entire `netloc` has to be updated.
    # The `rsplit()` approach is used instead of `replace()` in case the port happens to match
    # against part of the username/password/domain. See:
    # https://stackoverflow.com/a/21629125
    # https://stackoverflow.com/a/30846649
    netloc_minus_port = parsed_url.netloc.rsplit(':', 1)[0]
    stunnel_port = parsed_url.port + 1
    new_netloc = '{}:{}'.format(netloc_minus_port, stunnel_port)
    return parsed_url._replace(scheme='rediss', netloc=new_netloc).geturl()
