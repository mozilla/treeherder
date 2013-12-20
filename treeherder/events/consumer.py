from kombu.mixins import ConsumerMixin
from kombu import Connection, Exchange, Consumer, Queue


class EventsConsumer(ConsumerMixin):

    def __init__(self, connection):
        self.connection = connection
        self.exchange = Exchange("events", type="topic")
        self.consumers = []


    def get_consumers(self, Consumer, channel):
        return [
            Consumer(**c) for c in self.consumers
        ]

    def listen_to(self, routing_key, callback):
        queue = Queue(
            name="",
            channel=self.connection.channel(),
            exchange=self.exchange,
            routing_key=routing_key,
            durable=False,
            auto_delete=True
        )

        self.consumers.append(dict(queues=queue, callbacks=[callback]))
