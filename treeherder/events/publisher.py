import logging

from kombu import Connection, Exchange, Producer

logger = logging.getLogger(__name__)


class EventsPublisher(object):

    """Generic publisher class that specific publishers inherit from."""

    def __init__(self, connection_url, routing_key=None):
        self.connection_url = connection_url
        self.connection = None
        self.producer = None
        self.default_routing_key = routing_key
        self.exchange = Exchange("events", type="topic")
        self.logger = logger

    def connect(self):
        self.connection = Connection(self.connection_url)
        self.exchange = self.exchange(self.connection.channel)

    def disconnect(self):
        if self.connection:
            self.connection.release()
            self.connection = None
            self.producer = None

    def log(self, message):
        self.logger.info("{0}".format(message))

    def publish(self, message, routing_key=None):

        if not self.connection:
            self.connect()

        if not self.producer:
            self.producer = Producer(self.connection, self.exchange)

        routing_key = routing_key or self.default_routing_key
        if not routing_key:
            raise Exception("Routing key not specified")

        self.log("Publishing to exchange {0} with routing key {1}".format(
            self.exchange, routing_key
        ))

        self.producer.publish(message,
                              exchange=self.exchange,
                              routing_key=routing_key)


class JobStatusPublisher(EventsPublisher):

    def publish(self, job_guids, branch, status):
        message = {
            "job_guids": job_guids,
            "event": "job",
            "branch": branch,
            "status": status
        }

        super(JobStatusPublisher, self).publish(
            message,
            "events.{0}.job".format(branch)
        )


class JobFailurePublisher(EventsPublisher):

    def publish(self, job_id, branch):
        message = {
            "id": job_id,
            "event": "job_failure",
            "branch": branch
        }

        super(JobFailurePublisher, self).publish(
            message,
            "events.job_failure"
        )


class ResultsetPublisher(EventsPublisher):

    def publish(self, resultset_id, branch, author):
        message = {
            "id": resultset_id,
            "event": "resultset",
            "branch": branch,
            "author": author
        }

        super(ResultsetPublisher, self).publish(
            message,
            "events.{0}.resultset".format(branch))
