import logging
from urlparse import urlparse
from kombu import Connection, Exchange

from django.core.management.base import BaseCommand
from django.conf import settings

from treeherder.etl.pulse_consumer import JobConsumer

logger = logging.getLogger(__name__)


class Command(BaseCommand):

    """Management command to ingest jobs from a set of pulse exchanges."""

    help = "Ingest jobs from a set of pulse exchanges"

    def handle(self, *args, **options):
        config = settings.PULSE_DATA_INGESTION_CONFIG
        userid = urlparse(config).username
        durable = settings.PULSE_DATA_INGESTION_QUEUES_DURABLE
        auto_delete = settings.PULSE_DATA_INGESTION_QUEUES_AUTO_DELETE
        connection = Connection(config)
        consumer = JobConsumer(connection)

        try:
            for exchange_obj in settings.PULSE_DATA_INGESTION_EXCHANGES:
                exchange = Exchange(exchange_obj["name"], type="topic")
                exchange(connection).declare(passive=True)
                self.stdout.write("Connected to Pulse Exchange: {}".format(
                    exchange_obj["name"]))

                for project in exchange_obj["projects"]:
                    queue_name = "queue/{}/".format(userid)
                    for destination in exchange_obj['destinations']:
                        routing_key = "{}.{}".format(project, destination)
                        consumer.listen_to(
                            exchange,
                            routing_key,
                            queue_name,
                            durable,
                            auto_delete)
                        self.stdout.write(
                            "Pulse message consumer listening to : {} {}".format(
                                exchange.name,
                                routing_key
                            ))

            consumer.run()
        finally:
            consumer.close()
