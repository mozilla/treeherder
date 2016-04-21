import json
import logging
from urlparse import urlparse

import newrelic.agent
from django.conf import settings
from kombu import Queue
from kombu.mixins import ConsumerMixin

from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.etl.tasks.pulse_tasks import store_pulse_jobs

logger = logging.getLogger(__name__)


class JobConsumer(ConsumerMixin):
    """
    Consume jobs from Pulse exchanges
    """
    def __init__(self, connection):
        self.connection = connection
        self.consumers = []
        self.queue = None
        config = settings.PULSE_DATA_INGESTION_CONFIG
        self.queue_name = "queue/{}/jobs".format(urlparse(config).username)

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

    def on_message(self, body, message):
        try:
            if isinstance(body, dict):
                jobs = body
            else:
                jobs = json.loads(body)

            store_pulse_jobs.apply_async(
                args=[jobs],
                routing_key='store_pulse_jobs'
            )

        except:
            logger.error("Unable to load jobs: {}".format(body), exc_info=1)
            newrelic.agent.record_exception(params=body)

        # if we can't read the message here, then we should ack anyway to get
        # the bad message off the queue.  The logged error should give us
        # enough to track it down.
        message.ack()

    def close(self):
        self.connection.release()


class PulseApi(JsonExtractorMixin):
    """
    Get information from the pulse API
    """

    def get_bindings(self, queue_name):
        url = "{}queue/{}/{}".format(settings.PULSE_API_URL,
                                     queue_name,
                                     "bindings")
        return self.extract(url)
