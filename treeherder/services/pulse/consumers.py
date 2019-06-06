import logging

import newrelic.agent
from kombu import (Exchange,
                   Queue)
from kombu.mixins import ConsumerMixin

from treeherder.etl.common import fetch_json
from treeherder.etl.tasks.pulse_tasks import (store_pulse_jobs,
                                              store_pulse_pushes)

from .exchange import get_exchange

logger = logging.getLogger(__name__)


# Used for making API calls to Pulse Guardian, such as detecting bindings on
# the current ingestion queue.
PULSE_GUARDIAN_URL = "https://pulseguardian.mozilla.org/"


class PulseConsumer(ConsumerMixin):
    """
    Consume jobs from Pulse exchanges
    """

    def __init__(self, connection):
        self.connection = connection
        self.consumers = []
        self.queue = None
        self.queue_name = "queue/{}/{}".format(connection.userid, self.queue_suffix)

    def get_consumers(self, Consumer, channel):
        return [
            Consumer(**c) for c in self.consumers
        ]

    def bind_to(self, exchange, routing_key):
        if not self.queue:
            self.queue = Queue(
                name=self.queue_name,
                channel=self.connection.channel(),
                exchange=exchange,
                routing_key=routing_key,
                durable=True,
                auto_delete=False,
            )
            self.consumers.append(dict(queues=self.queue,
                                       callbacks=[self.on_message]))
            # just in case the queue does not already exist on Pulse
            self.queue.declare()
        else:
            self.queue.bind_to(exchange=exchange, routing_key=routing_key)

    def unbind_from(self, exchange, routing_key):
        self.queue.unbind_from(exchange, routing_key)

    def close(self):
        self.connection.release()

    def prune_bindings(self, new_bindings):
        # get the existing bindings for the queue
        bindings = []
        try:
            bindings = self.get_bindings(self.queue_name)["bindings"]
        except Exception:
            logger.error("Unable to fetch existing bindings for %s. Data ingestion may proceed, "
                         "but no bindings will be pruned", self.queue_name)

        # Now prune any bindings from the queue that were not
        # established above.
        # This indicates that they are no longer in the config, and should
        # therefore be removed from the durable queue bindings list.
        for binding in bindings:
            if binding["source"]:
                binding_str = self.get_binding_str(binding["source"],
                                                   binding["routing_key"])

                if binding_str not in new_bindings:
                    self.unbind_from(Exchange(binding["source"]),
                                     binding["routing_key"])
                    logger.info("Unbound from: %s", binding_str)

    def get_binding_str(self, exchange, routing_key):
        """Use consistent string format for binding comparisons"""
        return "{} {}".format(exchange, routing_key)

    def get_bindings(self, queue_name):
        """Get list of bindings from the pulse API"""
        return fetch_json("{}queue/{}/bindings".format(PULSE_GUARDIAN_URL, queue_name))


class JobConsumer(PulseConsumer):
    queue_suffix = "jobs"

    @newrelic.agent.background_task(name='pulse-listener-jobs.on_message', group='Pulse Listener')
    def on_message(self, body, message):
        exchange = message.delivery_info['exchange']
        routing_key = message.delivery_info['routing_key']
        logger.info('received job message from %s#%s', exchange, routing_key)
        store_pulse_jobs.apply_async(
            args=[body, exchange, routing_key],
            queue='store_pulse_jobs'
        )
        message.ack()


class UpdateJobFixtures(PulseConsumer):
    processedMessages = 0
    maxMessages = 5
    # This is the name of your queue on Pulse Guardian
    queue_suffix = "foo"
    messages = []

    def on_message(self, body, message):
        exchange = message.delivery_info['exchange']
        routing_key = message.delivery_info['routing_key']
        logger.debug('received job message from %s', exchange)
        # handleMessage expects messages in this format
        self.messages.append({
            "exchange": exchange,
            "routes": routing_key,
            "payload": body,
        })
        message.ack()
        self.processedMessages += 1
        self.close()
        if self.processedMessages > self.maxMessages:
            raise Exception('We have processed {} and need to store them'.format(self.processedMessages))


class PushConsumer(PulseConsumer):
    queue_suffix = "resultsets"

    @newrelic.agent.background_task(name='pulse-listener-pushes.on_message', group='Pulse Listener')
    def on_message(self, body, message):
        exchange = message.delivery_info['exchange']
        routing_key = message.delivery_info['routing_key']
        logger.info('received push message from %s#%s', exchange, routing_key)
        store_pulse_pushes.apply_async(
            args=[body, exchange, routing_key],
            queue='store_pulse_pushes'
        )
        message.ack()


def bind_to(consumer, exchange, routing_key):
    # bind the given consumer to the current exchange with a routing key
    consumer.bind_to(exchange=exchange, routing_key=routing_key)

    # get the binding key for this consumer
    binding = consumer.get_binding_str(exchange.name, routing_key)
    logger.info("Pulse queue {} bound to: {}".format(consumer.queue_name, binding))

    return binding


def prepare_consumer(connection, consumer_cls, sources, build_routing_key=None):
    consumer = consumer_cls(connection)
    bindings = []
    for source in sources:
        # split source string into exchange and routing key sections
        exchange, _, routing_keys = source.partition('.')

        # built an exchange object with our connection and exchange name
        exchange = get_exchange(connection, exchange)

        # split the routing keys up using the delimiter
        for routing_key in routing_keys.split(':'):
            if build_routing_key is not None:  # build routing key
                routing_key = build_routing_key(routing_key)

            binding = bind_to(consumer, exchange, routing_key)
            bindings.append(binding)

    # prune stale queues using the binding strings
    consumer.prune_bindings(bindings)

    return consumer
