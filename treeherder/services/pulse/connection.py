from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from kombu import Connection

config = settings.PULSE_DATA_INGESTION_CONFIG
if not config:
    raise ImproperlyConfigured("PULSE_DATA_INGESTION_CONFIG must be set")


def build_connection(url):
    """
    Build a Kombu Broker connection with the given url
    """
    return Connection(url)


pulse_conn = build_connection(config.geturl())
