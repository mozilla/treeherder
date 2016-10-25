import logging

from django.conf import settings
from kombu import (Exchange,
                   Queue)
from kombu.mixins import ConsumerMixin

from treeherder.etl.common import fetch_json
from treeherder.etl.tasks.pulse_tasks import (store_pulse_jobs,
                                              store_pulse_resultsets)

logger = logging.getLogger(__name__)


class PulseConsumer(ConsumerMixin):
    """
    Consume jobs from Pulse exchanges
    """
    def __init__(self, connection, queue_suffix):
        self.connection = connection
        self.consumers = []
        self.queue = None
        config = settings.PULSE_DATA_INGESTION_CONFIG
        if not config:
            raise ValueError("PULSE_DATA_INGESTION_CONFIG is required for the "
                             "JobConsumer class.")
        self.queue_name = "queue/{}/{}".format(config.username, queue_suffix)

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
                durable=settings.PULSE_DATA_INGESTION_QUEUES_DURABLE,
                auto_delete=settings.PULSE_DATA_INGESTION_QUEUES_AUTO_DELETE
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
            logger.error("Unable to fetch existing bindings for {}".format(
                self.queue_name))
            logger.error("Data ingestion may proceed, "
                         "but no bindings will be pruned")

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
                    logger.info("Unbound from: {}".format(binding_str))

    def get_binding_str(self, exchange, routing_key):
        """Use consistent string format for binding comparisons"""
        return "{} {}".format(exchange, routing_key)

    def get_bindings(self, queue_name):
        """Get list of bindings from the pulse API"""
        return fetch_json("{}queue/{}/bindings".format(
            settings.PULSE_GUARDIAN_URL, queue_name))


class JobConsumer(PulseConsumer):

    def on_message(self, body, message):
        exchange = message.delivery_info['exchange']
        routing_key = message.delivery_info['routing_key']
        logger.info('received job message from %s#%s' % (exchange, routing_key))
        store_pulse_jobs.apply_async(
            args=[body, exchange, routing_key],
            routing_key='store_pulse_jobs'
        )
        message.ack()


class ResultsetConsumer(PulseConsumer):

    def on_message(self, body, message):
        exchange = message.delivery_info['exchange']
        routing_key = message.delivery_info['routing_key']
        logger.info('received resultset message from %s#%s' % (exchange,
                                                               routing_key))
        store_pulse_resultsets.apply_async(
            args=[body, exchange, routing_key],
            routing_key='store_pulse_resultsets'
        )
        message.ack()
