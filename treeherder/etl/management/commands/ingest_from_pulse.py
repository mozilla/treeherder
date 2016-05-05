from django.conf import settings
from django.core.management.base import BaseCommand
from kombu import (Connection,
                   Exchange)

from treeherder.etl.pulse_consumer import (JobConsumer,
                                           PulseApi)


class Command(BaseCommand):

    """Management command to ingest jobs from a set of pulse exchanges."""

    help = "Ingest jobs from a set of pulse exchanges"

    def handle(self, *args, **options):
        config = settings.PULSE_DATA_INGESTION_CONFIG
        ssl = settings.PULSE_DATA_INGESTION_QUEUES_SSL

        with Connection(config, ssl=ssl) as connection:
            consumer = JobConsumer(connection)
            sources = settings.PULSE_DATA_INGESTION_SOURCES
            # get the existing bindings for the queue
            bindings = []
            try:
                bindings = PulseApi().get_bindings(consumer.queue_name)["bindings"]
            except:
                self.stdout.write(
                    "ERROR: Unable to fetch existing bindings for {}".format(
                        consumer.queue_name))
                self.stdout.write("ERROR: Data ingestion may proceed, but no bindings will be pruned")
            new_bindings = []

            for source in sources:
                # When creating this exchange object, it is important that it
                # be set to ``passive=True``.  This will prevent any attempt by
                # Kombu to actually create the exchange.
                exchange = Exchange(source["exchange"], type="topic",
                                    passive=True)
                # ensure the exchange exists.  Throw an error if it doesn't
                exchange(connection).declare()

                for project in source["projects"]:
                    for destination in source['destinations']:
                        routing_key = "{}.{}".format(destination, project)
                        consumer.bind_to(exchange, routing_key)
                        new_binding_str = self.get_binding_str(exchange.name,
                                                               routing_key)
                        new_bindings.append(new_binding_str)

                        self.stdout.write(
                            "Pulse queue {} bound to: {}".format(
                                consumer.queue_name,
                                new_binding_str
                            ))

            # Now prune any bindings from the our queue that were not
            # established above.
            # This indicates that they are no longer in the config, and should
            # therefore be removed from the durable queue bindings list.
            for binding in bindings:
                if binding["source"]:
                    binding_str = self.get_binding_str(binding["source"],
                                                       binding["routing_key"])

                    if binding_str not in new_bindings:
                        consumer.unbind_from(Exchange(binding["source"]),
                                             binding["routing_key"])
                        self.stdout.write("Unbound from: {}".format(binding_str))

            try:
                consumer.run()
            except KeyboardInterrupt:
                self.stdout.write("Pulse listening stopped...")

    def get_binding_str(self, exchange, routing_key):
        return "{} {}".format(exchange, routing_key)
