from django.core.management.base import BaseCommand

from treeherder.services.pulse import (PushConsumer,
                                       prepare_consumer,
                                       pulse_conn,
                                       push_sources)


class Command(BaseCommand):
    """
    Management command to read pushes from a set of pulse exchanges

    This adds the pushes to a celery queue called ``store_pulse_pushes`` which
    does the actual storing of the pushes in the database.
    """
    help = "Read pushes from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        with pulse_conn as connection:
            consumer = prepare_consumer(
                connection,
                PushConsumer,
                push_sources,
            )

            try:
                consumer.run()
            except KeyboardInterrupt:
                self.stdout.write("Pulse Push listening stopped...")
