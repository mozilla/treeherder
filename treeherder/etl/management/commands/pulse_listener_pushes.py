import environ
from django.core.management.base import BaseCommand

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
        if env.bool('SKIP_INGESTION', default=False):
            self.stdout.write("Skipping ingestion of Pulse Pushes")
            return
        # Specifies the Pulse services from which Treeherder will ingest push
        # information.  Sources can include properties `hgmo`, `github`, or both, to
        # listen to events from those sources.  The value is a JSON array of the form
        # [{pulse_url: .., hgmo: true, root_url: ..}, ..]
        push_sources = env.json(
            "PULSE_PUSH_SOURCES",
            default=[{"root_url": "https://firefox-ci-tc.services.mozilla.com", "github": True, "hgmo": True, "pulse_url": env("PULSE_URL")}])

        consumers = prepare_consumers(
            PushConsumer,
            push_sources,
        )

        try:
            consumers.run()
        except KeyboardInterrupt:
            pass
        self.stdout.write("Pulse Push listening stopped...")
