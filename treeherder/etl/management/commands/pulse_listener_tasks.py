import environ
from django.core.management.base import BaseCommand

from treeherder.services.pulse import TaskConsumer, prepare_consumers

env = environ.Env()


class Command(BaseCommand):
    """
    Management command to read jobs from a set of pulse exchanges

    This adds the jobs to a celery queue called ``store_pulse_tasks`` which
    does the actual storing of the jobs in the database.
    """

    help = "Read jobs from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        if env.bool('SKIP_INGESTION', default=False):
            self.stdout.write("Skipping ingestion of Pulse Tasks")
            return
        # Specifies the Pulse services from which Treeherder will consume task
        # information.  This value is a JSON array of the form [{pulse_url: ..,
        # root_url: ..}, ..]
        task_sources = env.json(
            "PULSE_TASK_SOURCES",
            default=[
                {
                    "root_url": "https://firefox-ci-tc.services.mozilla.com",
                    "pulse_url": env("PULSE_URL"),
                }
            ],
        )

        consumers = prepare_consumers(TaskConsumer, task_sources, lambda key: "#.{}".format(key),)

        try:
            consumers.run()
        except KeyboardInterrupt:
            pass
        self.stdout.write("Pulse Task listening stopped...")
