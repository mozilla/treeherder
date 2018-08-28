from django.core.management.base import BaseCommand

from treeherder.services.pulse import (JobConsumer,
                                       get_exchange,
                                       job_sources,
                                       pulse_conn)


class Command(BaseCommand):
    """
    Management command to read jobs from a set of pulse exchanges

    This adds the jobs to a celery queue called ``store_pulse_jobs`` which
    does the actual storing of the jobs in the database.
    """
    help = "Read jobs from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        new_bindings = []

        with pulse_conn as connection:
            consumer = JobConsumer(connection, "jobs")

            for source in job_sources:
                exchange = get_exchange(connection, source["exchange"])

                for project in source["projects"]:
                    routing_key = "#.{}".format(project)
                    consumer.bind_to(exchange=exchange, routing_key=routing_key)
                    new_binding_str = consumer.get_binding_str(exchange.name, routing_key)
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
