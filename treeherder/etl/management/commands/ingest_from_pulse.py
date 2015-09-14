import json
import logging
from django.core.management.base import BaseCommand
from django.conf import settings

from kombu import Connection, Exchange

from treeherder.etl.pulse_consumer import JobLoader, JobConsumer

logger = logging.getLogger(__name__)


class Command(BaseCommand):

    """Management command to ingest jobs from a set of pulse exchanges."""

    help = "Ingest jobs from a set of pulse exchanges"

    def handle(self, *args, **options):
        config = settings.PULSE_DATA_INGESTION_CONFIG
        connection = Connection(**config)
        consumer = JobConsumer(connection)

        for exchange_obj in settings.PULSE_DATA_INGESTION_EXCHANGES:
            exchange = Exchange(exchange_obj["name"], type="topic")
            exchange(connection).declare(passive=True)
            logger.info("Connected to Pulse Exchange: {}".format(exchange_obj["name"]))

            for project in exchange_obj["projects"]:
                queue_name = "queue/{}/".format(config['userid'])
                consumer.listen_to(exchange, project, queue_name, self.job_received)

        consumer.run()

    def job_received(self, *args, **kwargs):
        logger.info("Job received via Pulse")

        message = args[0]
        try:
            jobs = json.loads(message)
            jl = JobLoader()
            jl.process_job_list(jobs)
        except Exception:
            logger.error("Unable to load jobs: {}".format(message), exc_info=1)
