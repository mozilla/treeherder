from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.management.base import BaseCommand
from kombu import Exchange

from treeherder.services.pulse import (JobConsumer,
                                       pulse_conn)


class Command(BaseCommand):
    """
    Management command to read jobs from a set of pulse exchanges

    This adds the jobs to a celery queue called ``store_pulse_jobs`` which
    does the actual storing of the jobs in the database.
    """
    help = "Read jobs from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        sources = settings.PULSE_DATA_INGESTION_SOURCES
        if not sources:
            raise ImproperlyConfigured("PULSE_DATA_INGESTION_SOURCES must be set")

        new_bindings = []

        with pulse_conn as connection:
            consumer = JobConsumer(connection, "jobs")

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
                        new_binding_str = consumer.get_binding_str(
                            exchange.name,
                            routing_key)
                        new_bindings.append(new_binding_str)

                        self.stdout.write(
                            "Pulse queue {} bound to: {}".format(
                                consumer.queue_name,
                                new_binding_str
                            ))

            consumer.prune_bindings(new_bindings)

            try:
                consumer.run()
            except KeyboardInterrupt:
                self.stdout.write("Pulse Job listening stopped...")
