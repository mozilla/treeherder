import logging

from kombu.messaging import Producer
from kombu import Connection, Exchange
from urlparse import urlparse

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):

    """
    Management command to publish a job to a pulse exchange.

    This is primarily intended as a mechanism to test new or changed jobs
    to ensure they validate and will show as expected in the Treeherder UI.
    """

    help = "Publish jobs to a pulse exchange"

    def add_arguments(self, parser):
        parser.add_argument('routing_key', help="The routing key for publishing. Ex: 'mozilla-inbound.staging'")
        parser.add_argument('connection_url', help="The Pulse url. Ex: 'amqp://guest:guest@localhost:5672/'")
        parser.add_argument('payload_file', help="Path to the file that holds the job payload JSON")

    def handle(self, *args, **options):
        routing_key = options["routing_key"]
        connection_url = options["connection_url"]
        userid = urlparse(connection_url).username
        payload_file = options["payload_file"]

        exchange_name = "exchange/{}/jobs".format(userid)

        connection = Connection(connection_url)
        exchange = Exchange(exchange_name, type="topic")
        producer = Producer(connection,
                            exchange,
                            routing_key=routing_key,
                            auto_declare=True)

        self.stdout.write("Published to exchange: {}".format(exchange_name))

        with open(payload_file) as f:
            body = f.read()

            try:
                producer.publish(body)
            finally:
                connection.release()
