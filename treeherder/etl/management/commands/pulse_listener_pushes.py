import environ
from django.core.management.base import BaseCommand
from treeherder.services.pulse import (PushConsumer,
                                       TaskConsumer,
                                       prepare_consumers)

env = environ.Env()


class Command(BaseCommand):
    """
    Management command to read pushes as well jobs from a set of pulse exchanges

    This adds the pushes to a celery queue called ``store_pulse_pushes`` and ``store_pulse_tasks`` which
    do the actual storing of the pushes and jobs in the database respectively.
    """
    help = "Read pushes and jobs from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        # Specifies the Pulse services from which Treeherder will ingest push and will consume task
        # information.  Sources can include properties `hgmo`, `github`, or both, to
        # listen to events from those sources.  The value is a JSON array of the form
        # [{pulse_url: .., hgmo: true, root_url: ..}, ..]
        push_sources = env.json(
            "PULSE_PUSH_SOURCES",
            default=[{"root_url": "https://firefox-ci-tc.services.mozilla.com", "github": True, "hgmo": True, "pulse_url": env("PULSE_URL")}])

        push_consumers = prepare_consumers(
            PushConsumer,
            push_sources,
        )

        task_sources = env.json(
            "PULSE_TASK_SOURCES",
            default=[{"root_url": "https://firefox-ci-tc.services.mozilla.com", "pulse_url": env("PULSE_URL")}])

        task_consumers = prepare_consumers(
            TaskConsumer,
            task_sources,
            lambda key: "#.{}".format(key),
        )
        try:
            print("==========Listening to Pulse Tasks============")
            task_consumers.run()
        except KeyboardInterrupt:
            try:
                print("==========Listening to Pulse Pushes===========")
                push_consumers.run()
            except KeyboardInterrupt:
                pass
        self.stdout.write("Pulse Push and Task listening stopped...")
