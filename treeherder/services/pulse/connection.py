import environ
from django.utils.functional import SimpleLazyObject
from kombu import Connection

env = environ.Env()


def build_connection():
    """Build a Kombu Broker connection to Mozilla Pulse."""
    # Used to specify the PulseGuardian account that will be used to create
    # ingestion queues for the exchanges specified in ``PULSE_SOURCE_EXCHANGES``.
    # See https://pulse.mozilla.org/whats_pulse for more info.
    # Example: "amqp://myuserid:mypassword@pulse.mozilla.org:5672/?ssl=1"
    pulse_url = env.url("PULSE_URL")

    return Connection(pulse_url.get_url())


pulse_conn = SimpleLazyObject(build_connection)
