from django.core.management.base import BaseCommand

from treeherder.services.pulse import (JobConsumer,
                                       job_sources,
                                       prepare_consumer,
                                       pulse_conn)


class Command(BaseCommand):
    """
    Management command to read jobs from a set of pulse exchanges

    This adds the jobs to a celery queue called ``store_pulse_jobs`` which
    does the actual storing of the jobs in the database.
    """
    help = "Read jobs from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        with pulse_conn as connection:
            consumer = prepare_consumer(
                connection,
                JobConsumer,
                job_sources,
                lambda key: "#.{}".format(key),
            )

            try:
                consumer.run()
            except KeyboardInterrupt:
                self.stdout.write("Pulse Job listening stopped...")
