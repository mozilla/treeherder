import environ
from django.core.management.base import BaseCommand

from treeherder.services.pulse import (JointConsumer,
                                       prepare_joint_consumers)

env = environ.Env()


class Command(BaseCommand):
    """
    Management command to read tasks and pushes from a set of pulse exchanges.
    This adds the pushes to a celery queue called ```store_tasks_pushes``` and
    ```store_pulse_pushes```which does the actual storing of the pushes
    in the database.
    """
    help = "Read tasks and pushes from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        # Specifies the Pulse services from which Treeherder will ingest push
        # information.  Sources can include properties `hgmo`, `github`, or both, to
        # listen to events from those sources.  The value is a JSON array of the form
        # [{pulse_url: .., hgmo: true, root_url: ..}, ..]
        pulse_sources = env.json(
            "PULSE_SOURCES",
            default=[{"root_url": "https://firefox-ci-tc.services.mozilla.com",
                      "github": True,
                      "hgmo": True,
                      "pulse_url": env("PULSE_URL"),
                      "tasks": True}])

        listener_params = (JointConsumer, pulse_sources, [lambda key: "#.{}".format(key), None])
        consumer = prepare_joint_consumers(listener_params)

        try:
            consumer.run()
        except KeyboardInterrupt:
            pass
        self.stdout.write("Pulse and Task listening stopped......")
