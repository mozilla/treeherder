import environ
from kombu import Connection

env = environ.Env()

# Used to specify the PulseGuardian account that will be used to create
# ingestion queues for the exchanges specified in ``PULSE_DATA_INGESTION_SOURCES``.
# See https://pulse.mozilla.org/whats_pulse for more info.
# Example: "amqp://myuserid:mypassword@pulse.mozilla.org:5672/?ssl=1"
config = env.url("PULSE_URI")


def build_connection(url):
    """
    Build a Kombu Broker connection with the given url
    """
    return Connection(url)


pulse_conn = build_connection(config.geturl())
