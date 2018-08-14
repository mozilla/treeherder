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


class TreeherderPublisher(object):
    def _generate_publish(self):
        # Create producer
        producer = kombu.Producer(
            channel=self.connection,
            exchange=kombu.Exchange(
                name="exchange/{}/v1/job-actions".format(self.namespace),
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
            # validate kwargs against the job action schema
            schemas = load_schemas()
            schema = "https://treeherder.mozilla.org/schemas/v1/job-action-message.json#"
            jsonschema.validate(kwargs, schemas[schema])

            # build the routing key from the message's kwargs
            routing_key = "{}.{}.{}.".format(
                kwargs["build_system_type"],
                kwargs["project"],
                kwargs["action"],
            )

            publish_message(
                body=json.dumps(kwargs),
                routing_key=routing_key,
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
        self.namespace = namespace
        self.connection = kombu.Connection(uri)

        self.job_action = self._generate_publish()
