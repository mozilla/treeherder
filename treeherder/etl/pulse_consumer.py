import logging
import json

from kombu import Queue
from kombu.mixins import ConsumerMixin

from treeherder.etl.tasks.pulse_tasks import store_pulse_jobs


logger = logging.getLogger(__name__)


class JobConsumer(ConsumerMixin):
    """
    Consume jobs from Pulse exchanges
    """
    def __init__(self, connection):
        self.connection = connection
        self.consumers = []

    def get_consumers(self, Consumer, channel):
        return [
            Consumer(**c) for c in self.consumers
        ]

    def listen_to(self, exchange, routing_key, queue_name, durable=False):
        queue = Queue(
            name=queue_name,
            channel=self.connection.channel(),
            exchange=exchange,
            routing_key=routing_key,
            durable=durable,
            auto_delete=True
        )

        self.consumers.append(dict(queues=queue, callbacks=[self.on_message]))

    def on_message(self, body, message):
        try:
            jobs = json.loads(body)
            store_pulse_jobs.apply_async(
                args=[jobs],
                routing_key='store_pulse_jobs'
            )
            message.ack()

        except Exception:
            logger.error("Unable to load jobs: {}".format(message), exc_info=1)

    def close(self):
        self.connection.release()
