import logging
from kombu.messaging import Producer
from kombu import Connection, Exchange

from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)


class Command(BaseCommand):

    """
    Management command to publish a job to a pulse exchange.

    This is primarily intended as a mechanism to test new or changed jobs
    to ensure they validate and will show as expected in the Treeherder UI.
    """

    help = "Publish jobs to a pulse exchange"

    def add_arguments(self, parser):
        parser.add_argument('project', help="The project/repo to post jobs for (e.g.: mozilla-inbound")
        parser.add_argument('payload_file', help="Path to the file that holds the job payload JSON")

    def handle(self, *args, **options):
        project = options["project"]
        payload_file = options["payload_file"]
        config = settings.PULSE_DATA_INGESTION_CONFIG

        exchange_name = "exchange/{}/jobs".format(config["userid"])

        connection = Connection(**config)
        exchange = Exchange(exchange_name, type="topic")
        producer = Producer(connection,
                            exchange,
                            routing_key=project,
                            auto_declare=True)

        logger.info("Publish to exchange: {}".format(exchange_name))

        with open(payload_file) as f:
            body = f.read()

            try:
                producer.publish(body)
            finally:
                connection.release()
