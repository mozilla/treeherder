import environ
from django.core.management.base import BaseCommand

from treeherder.config import settings
from treeherder.services.pulse import (PushConsumer,
                                       prepare_consumers)

env = environ.Env()


class Command(BaseCommand):
    """
    Management command to read pushes from a set of pulse exchanges

    This adds the pushes to a celery queue called ``store_pulse_pushes`` which
    does the actual storing of the pushes in the database.
    """
    help = "Read pushes from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        push_sources = settings.PULSE_PUSH_SOURCES

        consumers = prepare_consumers(
            PushConsumer,
            push_sources,
        )

        try:
            consumers.run()
        except KeyboardInterrupt:
            pass
        self.stdout.write("Pulse Push listening stopped...")
