import glob
import json
import logging
import os

import jsonschema
from django.conf import settings
from kombu import (Connection,
                   Exchange,
                   Producer)

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

        # Create publication method for the exchange
        def publish(namespace, **message_kwargs):
            # create a connection to Pulse
            # TODO: use pulse_conn once we've combined PULSE_URI and PULSE_URL
            connection = Connection(settings.PULSE_URI)

            # build up a Producer object from which we can construct the
            # publish_message function
            producer = Producer(
                channel=connection,
                exchange=Exchange(
                    name="exchange/{}/v1/job-actions".format(namespace),
                    type='topic',
                    durable=True,
                    delivery_mode='persistent'
                ),
                auto_declare=True
            )
            publish_message = connection.ensure(producer, producer.publish, max_retries=3)

            # validate kwargs against the job action schema
            schemas = load_schemas()
            schema = "https://treeherder.mozilla.org/schemas/v1/job-action-message.json#"
            jsonschema.validate(message_kwargs, schemas[schema])

            # build the routing key from the message's kwargs
            routing_key = "{}.{}.{}.".format(
                message_kwargs["build_system_type"],
                message_kwargs["project"],
                message_kwargs["action"],
            )

            publish_message(
                body=json.dumps(message_kwargs),
                routing_key=routing_key,
                content_type='application/json'
            )

        return publish

    def __init__(self):
        """
        Create publisher, requires a connection_string and a mapping from
        JSON schema uris to JSON schemas.
        """
        self.job_action = self._generate_publish()
