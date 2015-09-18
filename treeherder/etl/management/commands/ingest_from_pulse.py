import logging
import environ

from django.core.management.base import BaseCommand
from django.conf import settings

from kombu import Connection, Exchange

from treeherder.etl.pulse_consumer import JobConsumer

logger = logging.getLogger(__name__)


class Command(BaseCommand):

    """Management command to ingest jobs from a set of pulse exchanges."""

    help = "Ingest jobs from a set of pulse exchanges"

    def handle(self, *args, **options):
        env = environ.Env()
        config = env.url("PULSE_DATA_INGESTION_CONFIG").geturl()
        userid = env.str("PULSE_QUEUE_USERID")
        connection = Connection(config)
        consumer = JobConsumer(connection)

        try:
            for exchange_obj in settings.PULSE_DATA_INGESTION_EXCHANGES:
                exchange = Exchange(exchange_obj["name"], type="topic")
                exchange(connection).declare(passive=True)
                logger.info("Connected to Pulse Exchange: {}".format(exchange_obj["name"]))

                for project in exchange_obj["projects"]:
                    queue_name = "queue/{}/".format(userid)
                    consumer.listen_to(exchange, project, queue_name)

            consumer.run()
        finally:
            consumer.close()
