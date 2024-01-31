import environ
from django.core.management.base import BaseCommand

from treeherder.services.pulse import MozciClassificationConsumer, prepare_consumers

env = environ.Env()


class Command(BaseCommand):
    """
    Management command to read jobs from a set of pulse exchanges and retrieve
    the mozci classification generated for a specific push

    This adds the jobs to a celery queue called ``store_pulse_tasks_classification``
    which does the actual storing of the classifications in the database.
    """

    help = "Read mozci classification jobs from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        if env.bool("SKIP_INGESTION", default=False):
            self.stdout.write("Skipping ingestion of Pulse Mozci Classification Tasks")
            return
        # Specifies the Pulse services from which Treeherder will consume task
        # information.  This value is a JSON array of the form [{pulse_url: ..,
        # root_url: ..}, ..]
        classification_sources = env.json(
            "PULSE_MOZCI_CLASSIFICATION_SOURCES",
            default=[
                {
                    "root_url": "https://community-tc.services.mozilla.com",
                    "vhost": "communitytc",
                    "pulse_url": env("PULSE_URL"),
                }
            ],
        )

        consumers = prepare_consumers(
            MozciClassificationConsumer,
            classification_sources,
            lambda key: "#.{}".format(key),
        )

        try:
            consumers.run()
        except KeyboardInterrupt:
            pass
        self.stdout.write("Pulse Mozci Classification Task listening stopped...")
