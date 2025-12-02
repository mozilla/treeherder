import logging
import socket
import threading

import environ
from django.conf import settings
from kombu import Connection, Exchange, Queue
from kombu.mixins import ConsumerMixin

from treeherder.etl.tasks.pulse_tasks import (
    store_pulse_pushes,
    store_pulse_tasks,
    store_pulse_tasks_classification,
)
from treeherder.utils.http import fetch_json

from .exchange import get_exchange

env = environ.Env()
logger = logging.getLogger(__name__)


# Used for making API calls to Pulse Guardian, such as detecting bindings on
# the current ingestion queue.
PULSE_GUARDIAN_URL = "https://pulseguardian.mozilla.org/"

TASKCLUSTER_TASK_BINDINGS = [
    "exchange/taskcluster-queue/v1/task-defined.#",
    "exchange/taskcluster-queue/v1/task-pending.#",
    "exchange/taskcluster-queue/v1/task-running.#",
    "exchange/taskcluster-queue/v1/task-completed.#",
    "exchange/taskcluster-queue/v1/task-failed.#",
    "exchange/taskcluster-queue/v1/task-exception.#",
]

GITHUB_PUSH_BINDINGS = [
    "exchange/taskcluster-github/v1/push.#",
    "exchange/taskcluster-github/v1/pull-request.#",
]

HGMO_PUSH_BINDINGS = [
    "exchange/hgpushes/v1.#",
]

MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS = [
    "exchange/taskcluster-queue/v1/task-completed.route.index.project.mozci.classification.#",
]
MOZCI_CLASSIFICATION_TESTING_BINDINGS = [
    "exchange/taskcluster-queue/v1/task-completed.route.index.project.mozci.testing.classification.#",
]


class PulseConsumer(ConsumerMixin):
    """
    Consume jobs from Pulse exchanges
    """

    def __init__(self, source, build_routing_key):
        self.connection = Connection(source["pulse_url"], virtual_host=source.get("vhost", "/"))
        self.consumers = []
        self.queue = None
        self.queue_name = f"queue/{self.connection.userid}/{self.queue_suffix}"
        self.root_url = source["root_url"]
        self.source = source
        self.build_routing_key = build_routing_key

    def get_consumers(self, consumer, channel):
        return [consumer(**c) for c in self.consumers]

    def bindings(self):
        """Get the bindings for this consumer, each of the form `<exchange>.<routing_keys>`,
        with `<routing_keys>` being `:`-separated."""
        return []

    def prepare(self):
        bindings = []
        for binding in self.bindings():
            # split source string into exchange and routing key sections
            exchange, _, routing_keys = binding.partition(".")

            # built an exchange object with our connection and exchange name
            exchange = get_exchange(self.connection, exchange)

            # split the routing keys up using the delimiter
            for routing_key in routing_keys.split(":"):
                if self.build_routing_key is not None:  # build routing key
                    routing_key = self.build_routing_key(routing_key)

                binding = self.bind_to(exchange, routing_key)
                bindings.append(binding)

        # prune stale queues using the binding strings
        self.prune_bindings(bindings)

    def bind_to(self, exchange, routing_key):
        if not self.queue:
            self.queue = Queue(
                name=self.queue_name,
                channel=self.connection.channel(),
                exchange=exchange,
                routing_key=routing_key,
                durable=True,
                auto_delete=settings.PULSE_AUTO_DELETE_QUEUES,
            )
            self.consumers.append(dict(queues=self.queue, callbacks=[self.on_message]))
            # just in case the queue does not already exist on Pulse
            self.queue.declare()
        else:
            self.queue.bind_to(exchange=exchange, routing_key=routing_key)

        # get the binding key for this consumer
        binding = self.get_binding_str(exchange.name, routing_key)
        logger.info(f"Pulse queue {self.queue_name} bound to: {binding}")

        return binding

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
            logger.error(
                f"Unable to fetch existing bindings for {self.queue_name}. Data ingestion may proceed, "
                "but no bindings will be pruned",
            )

        # Now prune any bindings from the queue that were not
        # established above.
        # This indicates that they are no longer in the config, and should
        # therefore be removed from the durable queue bindings list.
        for binding in bindings:
            if binding["source"]:
                binding_str = self.get_binding_str(binding["source"], binding["routing_key"])

                if binding_str not in new_bindings:
                    self.unbind_from(Exchange(binding["source"]), binding["routing_key"])
                    logger.info(f"Unbound from: {binding_str}")

    def get_binding_str(self, exchange, routing_key):
        """Use consistent string format for binding comparisons"""
        return f"{exchange} {routing_key}"

    def get_bindings(self, queue_name):
        """Get list of bindings from the pulse API"""
        return fetch_json(f"{PULSE_GUARDIAN_URL}queue/{queue_name}/bindings")


class TaskConsumer(PulseConsumer):
    queue_suffix = env("PULSE_TASKS_QUEUE_NAME", default="tasks")

    def bindings(self):
        return TASKCLUSTER_TASK_BINDINGS

    def on_message(self, body, message):
        exchange = message.delivery_info["exchange"]
        routing_key = message.delivery_info["routing_key"]
        logger.debug(f"received job message from {exchange}#{routing_key}")
        store_pulse_tasks.apply_async(
            args=[body, exchange, routing_key, self.root_url], queue="store_pulse_tasks"
        )
        message.ack()


class MozciClassificationConsumer(PulseConsumer):
    queue_suffix = env("PULSE_MOZCI_CLASSIFICATION_QUEUE_NAME", default="tasksclassification")

    def bindings(self):
        mozci_env = env("PULSE_MOZCI_ENVIRONMENT", default="production")
        if mozci_env == "testing":
            return MOZCI_CLASSIFICATION_TESTING_BINDINGS

        if mozci_env != "production":
            logger.warning(
                f"PULSE_MOZCI_ENVIRONMENT should be testing or production not {mozci_env}, defaulting to production"
            )
        return MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS

    def on_message(self, body, message):
        exchange = message.delivery_info["exchange"]
        routing_key = message.delivery_info["routing_key"]
        logger.debug(f"received mozci classification job message from {exchange}#{routing_key}")
        store_pulse_tasks_classification.apply_async(
            args=[body, exchange, routing_key, self.root_url],
            queue="store_pulse_tasks_classification",
        )
        message.ack()


class PushConsumer(PulseConsumer):
    queue_suffix = env("PULSE_RESULSETS_QUEUE_NAME", default="resultsets")

    def bindings(self):
        rv = []
        if self.source.get("hgmo"):
            rv += HGMO_PUSH_BINDINGS
        if self.source.get("github"):
            rv += GITHUB_PUSH_BINDINGS
        return rv

    def on_message(self, body, message):
        exchange = message.delivery_info["exchange"]
        routing_key = message.delivery_info["routing_key"]
        logger.info(f"received push message from {exchange}#{routing_key}")
        store_pulse_pushes.apply_async(
            args=[body, exchange, routing_key, self.root_url], queue="store_pulse_pushes"
        )
        message.ack()


class JointConsumer(PulseConsumer):
    """
    Run a collection of consumers in parallel.  These may be connected to different
    AMQP servers, and Kombu only supports communicating with one connection per
    thread, so we use multiple threads, one per consumer.
    """

    queue_suffix = env("PULSE_QUEUE_NAME", default=f"queue_{socket.gethostname()}")

    def bindings(self):
        rv = []
        if self.source.get("hgmo"):
            rv += HGMO_PUSH_BINDINGS
        if self.source.get("github"):
            rv += GITHUB_PUSH_BINDINGS
        if self.source.get("tasks"):
            rv += TASKCLUSTER_TASK_BINDINGS
        if self.source.get("mozci-classification"):
            mozci_env = env("PULSE_MOZCI_ENVIRONMENT", default="production")
            if mozci_env == "testing":
                rv += MOZCI_CLASSIFICATION_TESTING_BINDINGS
            else:
                if mozci_env != "production":
                    logger.warning(
                        f"PULSE_MOZCI_ENVIRONMENT should be testing or production not {mozci_env}, defaulting to production"
                    )
                rv += MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS

        return rv

    def on_message(self, body, message):
        exchange = message.delivery_info["exchange"]
        routing_key = message.delivery_info["routing_key"]
        logger.debug(f"received job message from {exchange}#{routing_key}")
        if exchange.startswith("exchange/taskcluster-queue/v1/"):
            store_pulse_tasks.apply_async(
                args=[body, exchange, routing_key, self.root_url], queue="store_pulse_tasks"
            )
            if "task-completed" in exchange and ".proj-mozci." in routing_key:
                store_pulse_tasks_classification.apply_async(
                    args=[body, exchange, routing_key, self.root_url],
                    queue="store_pulse_tasks_classification",
                )
        else:
            store_pulse_pushes.apply_async(
                args=[body, exchange, routing_key, self.root_url], queue="store_pulse_pushes"
            )
        message.ack()


class Consumers:
    def __init__(self, consumers):
        self.consumers = consumers

    def run(self):
        def thd(consumer):
            consumer.prepare()
            consumer.run()

        threads = [threading.Thread(target=thd, args=(c,), daemon=True) for c in self.consumers]
        for t in threads:
            t.start()
        for t in threads:
            t.join()


def prepare_consumers(consumer_cls, sources, build_routing_key=None):
    return Consumers([consumer_cls(source, build_routing_key) for source in sources])


def prepare_joint_consumers(listening_params):
    def unpacker(x, y, z):
        return x, y, z

    consumer_class, sources, keys = unpacker(*listening_params)
    return Consumers([consumer_class(source, key) for source, key in zip(sources, keys)])
