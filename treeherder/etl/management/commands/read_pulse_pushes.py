from django.core.management.base import BaseCommand

from treeherder.services.pulse import (PushConsumer,
                                       get_exchange,
                                       pulse_conn,
                                       push_sources)


class Command(BaseCommand):
    """
    Management command to read pushes from a set of pulse exchanges

    This adds the pushes to a celery queue called ``store_pulse_resultsets`` which
    does the actual storing of the pushes in the database.
    """
    help = "Read pushes from a set of pulse exchanges and queue for ingestion"

    def handle(self, *args, **options):
        new_bindings = []

        with pulse_conn as connection:
            consumer = PushConsumer(connection, "resultsets")

            for source in push_sources:
                exchange, _, routing_keys = source.partition('.')
                exchange = get_exchange(connection, exchange)

                for routing_key in routing_keys.split(','):
                    consumer.bind_to(exchange, routing_key)
                    new_binding_str = consumer.get_binding_str(
                        exchange.name,
                        routing_key)
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
                self.stdout.write("Pulse Push listening stopped...")
