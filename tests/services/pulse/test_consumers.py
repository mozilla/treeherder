from treeherder.services.pulse import (JobConsumer,
                                       PushConsumer,
                                       prepare_consumer)
from treeherder.services.pulse.consumers import bind_to

from .utils import create_and_destroy_exchange


def test_bind_to(pulse_connection, pulse_exchange):
    job_consumer = JobConsumer(pulse_connection)
    exchange = pulse_exchange("exchange/taskcluster-queue/v1/task-running", create_exchange=True)
    routing_key = "test_routing_key"

    binding = bind_to(job_consumer, exchange, routing_key)

    # Our Consumer should only have one consumer
    assert len(job_consumer.consumers) == 1

    queue = job_consumer.consumers[0]["queues"]

    # check construction of kombu.Queue from Consumer.bind_to
    assert queue.exchange == exchange
    assert queue.routing_key == routing_key

    # test Consumer.get_binding_str constructed a correct binding string
    assert binding == "{} {}".format(exchange.name, routing_key)


def test_prepare_consumer(pulse_connection, pulse_exchange):
    # create the exchange in the local RabbitMQ instance
    job_exchange = "exchange/taskcluster-queue/v1/task-running"
    with create_and_destroy_exchange(pulse_connection, job_exchange):
        job_consumer = prepare_consumer(
            pulse_connection,
            JobConsumer,
            ["{}.test_project".format(job_exchange)],
            lambda key: "foo.{}".format(key),
        )

    assert isinstance(job_consumer, JobConsumer)
    assert len(job_consumer.consumers) == 1

    queue = job_consumer.consumers[0]["queues"]
    assert queue.routing_key == "foo.test_project"
    assert queue.exchange.name == "exchange/taskcluster-queue/v1/task-running"

    push_exchange = "exchange/taskcluster-github/v1/push"
    with create_and_destroy_exchange(pulse_connection, push_exchange):
        push_consumer = prepare_consumer(
            pulse_connection,
            PushConsumer,
            ["{}.test_key".format(push_exchange)],
        )

    assert isinstance(push_consumer, PushConsumer)
    assert len(push_consumer.consumers) == 1

    # check the bound queues were configured based on sources correctly
    queue = push_consumer.consumers[0]["queues"]
    assert queue.routing_key == "test_key"
    assert queue.exchange.name == "exchange/taskcluster-github/v1/push"
