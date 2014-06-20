from kombu.mixins import ConsumerMixin
from kombu import Connection, Exchange, Consumer, Queue
import logging

logger = logging.getLogger(__name__)

class EventsConsumer(ConsumerMixin):
    """
    A specialized message consumer for the 'events' exchange.

    The subscription mechanism is based on a simple routing key with the
    following structure:

    [ * | try | mozilla-inbound | ...]( [ * | job | job_failure | resultset ] )

    The first member is the branch name (or a * wildcard) and the second
    optional member is the event type (again * is allowed).

    For example you can subscribe using the following keys:

    * (equivalent to *.*)
    *.job
    try.*
    try.job_failure
    """
    def __init__(self, connection):
        self.connection = connection
        self.exchange = Exchange("events", type="topic")
        self.consumers = []

    def get_consumers(self, Consumer, channel):
        return [
            Consumer(**c) for c in self.consumers
        ]

    def listen_to(self, routing_key, callback):
        logger.info("message consumer listening to : {0}".format(
            routing_key
        ))

        queue = Queue(
            name="",
            channel=self.connection.channel(),
            exchange=self.exchange,
            routing_key=routing_key,
            durable=False,
            auto_delete=True
        )

        self.consumers.append(dict(queues=queue, callbacks=[callback]))
