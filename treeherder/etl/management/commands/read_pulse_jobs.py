from django.conf import settings
from django.core.management.base import BaseCommand
from kombu import (Connection,
                   Exchange)

from treeherder.etl.common import fetch_json
from treeherder.etl.pulse_consumer import JobConsumer


class Command(BaseCommand):

    """
    Management command to read jobs from a set of pulse exchanges

    This adds the jobs to a celery queue called ``store_pulse_jobs`` which
    does the actual storing of the jobs in the database.
    """

    help = "Read jobs from a set of pulse exchanges and queue for storage"

    def handle(self, *args, **options):
        config = settings.PULSE_DATA_INGESTION_CONFIG
        assert config, "PULSE_DATA_INGESTION_CONFIG must be set"
        sources = settings.PULSE_DATA_INGESTION_SOURCES
        assert sources, "PULSE_DATA_INGESTION_SOURCES must be set"

        # get the existing bindings for the queue
        bindings = []
        new_bindings = []

        with Connection(config.geturl()) as connection:
            consumer = JobConsumer(connection)
            try:
                bindings = self.get_bindings(consumer.queue_name)["bindings"]
            except Exception:
                self.stderr.write(
                    "ERROR: Unable to fetch existing bindings for {}".format(
                        consumer.queue_name))
                self.stderr.write("ERROR: Data ingestion may proceed, "
                                  "but no bindings will be pruned")

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
        """Use consistent string format for binding comparisons"""
        return "{} {}".format(exchange, routing_key)

    def get_bindings(self, queue_name):
        """Get list of bindings from the pulse API"""
        return fetch_json("{}queue/{}/{}".format(settings.PULSE_API_URL,
                                                 queue_name,
                                                 "bindings"))
