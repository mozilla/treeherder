from furl import furl


def connection_should_use_tls(url):
    # Ensure use of celery workers for local development
    host = furl(url).host or url  # The url passed is already just the hostname.
    return host not in ("127.0.0.1", "localhost", "mysql", "rabbitmq")
