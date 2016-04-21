from django.conf import settings
from django.core.management.base import BaseCommand
from kombu import (Connection,
                   Exchange)

from treeherder.etl.pulse_consumer import JobConsumer


class Command(BaseCommand):

    """Management command to ingest jobs from a set of pulse exchanges."""

    help = "Ingest jobs from a set of pulse exchanges"

    def handle(self, *args, **options):
        config = settings.PULSE_DATA_INGESTION_CONFIG

        with Connection(config, ssl=True) as connection:
            consumer = JobConsumer(connection)

            for source in settings.PULSE_DATA_INGESTION_SOURCES:
                # When creating this exchange object, it is critical that it
                # be set to ``passive=True``.  This allows it to connect to an
                # exchange not owned by this userid by making it read-only.
                # If passive is not set to True, you may get a 403 Forbidden
                # when trying to connect to the exchange.
                exchange = Exchange(source["exchange"],
                                    type="topic",
                                    # passive=True
                                    )
                # ensure the exchange exists.  Throw an error if it doesn't
                exchange(connection).declare(passive=True)

                for project in source["projects"]:
                    for destination in source['destinations']:
                        routing_key = "{}.{}".format(destination, project)
                        consumer.listen_to(exchange, routing_key)

                        self.stdout.write(
                            "Pulse queue {} bound to: {} {}".format(
                                consumer.queue_name,
                                exchange.name,
                                routing_key
                            ))

            try:
                # TODO: need to be sure that if we hit an error in run(), that
                # we log that to treeherder, or stdout
                consumer.run()
            except KeyboardInterrupt:
                self.stdout.write("Pulse listening stopped...")
