import glob
import json
import logging
import os

import jsonschema
import kombu
from django.conf import settings

logger = logging.getLogger(__name__)


def load_schemas():
    """ Load JSON schemas from folder """
    schemas = {}

    # List json files in folder
    folder = os.path.join(settings.PROJECT_DIR, '..', 'schemas')
    for filename in glob.iglob("{}/*.json".format(folder)):
        # Read file and insert into schemas
        with open(filename) as f:
            data = json.load(f)

            if 'id' not in data:
                raise ValueError("JSON schemas must have an 'id' property")

            schemas[data['id']] = data

    # Return schemas loaded
    return schemas


class JobAction(object):
    exchange = "job-actions"
    title = "Actions issued by jobs"
    description = """
        There are a number of actions which can be done to a job
        (retrigger/cancel) they are published on this exchange
    """
    schema = "https://treeherder.mozilla.org/schemas/v1/job-action-message.json#"

    def message(self, message):
        """ Construct message """
        return message

    def routing(self, **keys):
        """ Construct routing key """
        return "{}.{}.{}.".format(
            keys["build_system_type"],
            keys["project"],
            keys["action"],
        )


class TreeherderPublisher(object):
    title = "TreeHerder Exchanges"
    description = """
        Exchanges for services that wants to know what shows up on TreeHerder.
    """

    def _generate_publish(self, name, exchange):
        # Create producer for the exchange
        exchange_path = "exchange/%s/v1/%s" % (
            self.namespace,
            exchange.exchange
        )
        producer = kombu.Producer(
            channel=self.connection,
            exchange=kombu.Exchange(
                name=exchange_path,
                type='topic',
                durable=True,
                delivery_mode='persistent'
            ),
            auto_declare=True
        )

        publish_message = self.connection.ensure(
            producer, producer.publish, max_retries=3
        )

        # Create publication method for the exchange
        def publish(**kwargs):
            message = exchange.message(kwargs)
            jsonschema.validate(message, self.schemas[exchange.schema])
            publish_message(
                body=json.dumps(message),
                routing_key=exchange.routing(**kwargs),
                content_type='application/json'
            )

        return publish

    def __init__(self, namespace, uri):
        """
        Create publisher, requires a connection_string and a mapping from
        JSON schema uris to JSON schemas.

        :param str: Namespace used when publishing on pulse.
        :param str: URI for pulse.
        """
        # Set attributes
        self.schemas = load_schemas()
        self.namespace = namespace
        self.connection = kombu.Connection(uri)

        # Find exchanges
        self.exchanges = [("job_action", JobAction())]

        # Wrap exchanges in functions
        for name, exchange in self.exchanges:
            setattr(self, name, self._generate_publish(name, exchange))
