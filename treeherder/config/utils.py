from urlparse import urlparse


def connection_should_use_tls(url):
    hostname = urlparse(url).hostname
    # Services such as RabbitMQ/Elasticsearch running on Travis do not yet have TLS
    # certificates set up. We could try using TLS locally using self-signed certs,
    # but until Travis has support it's not overly useful.
    return hostname != 'localhost'
