from django.core.management.base import BaseCommand

from treeherder.services.pulse import (TaskConsumer,
                                       prepare_consumer,
                                       pulse_conn,
                                       task_sources)


class Command(BaseCommand):
    """
    Management command to read jobs from a set of pulse exchanges

    This adds the jobs to a celery queue called ``store_pulse_tasks`` which
    does the actual storing of the jobs in the database.
    """
    help = "Read jobs from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        with pulse_conn as connection:
            consumer = prepare_consumer(
                connection,
                TaskConsumer,
                task_sources,
                lambda key: "#.{}".format(key),
            )

            try:
                consumer.run()
            except KeyboardInterrupt:
                self.stdout.write("Pulse Job listening stopped...")
