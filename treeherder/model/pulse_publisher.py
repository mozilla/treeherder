import json
import logging
import os
import re

import jsonschema
import kombu

logger = logging.getLogger(__name__)


def toCamelCase(input):
    def replace(match):
        return match.group(1).upper()
    return re.sub(r'_(.)', replace, input)


def load_schemas(folder):
    """ Load JSON schemas from folder """
    schemas = {}

    # List files in folder
    for filename in os.listdir(folder):
        # Skip non-json files
        if not filename.endswith('.json'):
            continue

        # Read file and insert into schemas
        with open(os.path.join(folder, filename)) as f:
            data = json.load(f)
            assert 'id' in data, "JSON schemas must have an 'id' property"
            schemas[data['id']] = data

    # Return schemas loaded
    return schemas


class Exchange(object):

    """
        Exchange declaration that can be used as property on a subclass of
        PulsePublisher.
    """

    def __init__(self, exchange, title, description, routing_keys, schema):
        """
          Create exchange instance
        """
        self.exchange = exchange
        self.title = title
        self.description = description
        self.routing_keys = routing_keys
        self.schema = schema

    def message(self, message):
        """ Construct message """
        return message

    def routing(self, **keys):
        """ Construct routing key """
        return '.'.join([key.build(**keys) for key in self.routing_keys])

    def reference(self, name):
        """ Construct reference entry with given name """
        return {
            'type': 'topic-exchange',
            'exchange': self.exchange,
            'name': toCamelCase(name),
            'title': self.title,
            'description': self.description,
            'routingKey': [key.reference() for key in self.routing_keys],
            'schema': self.schema
        }


class Key(object):

    """ Routing key entry """

    def __init__(self, name, summary, required=True, multiple_words=False):
        self.name = name
        self.summary = summary
        self.required = required
        self.multiple_words = multiple_words

    def build(self, **keys):
        """ Build routing key entry """
        key = keys.get(self.name)
        # Ensure the key is present if required
        if self.required and key is None:
            raise ValueError("Key %s is required" % self.name)
        key = key or '_'
        # Check if has multiple words
        if '.' in key and not self.multiple_words:
            raise ValueError("Key %s cannot contain dots" % self.name)
        # Return constructed key
        return key

    def reference(self):
        """ Construct reference entry for this routing key entry """
        return {
            'name': toCamelCase(self.name),
            'summary': self.summary,
            'multipleWords': self.multiple_words,
            'required': self.required
        }


class PulsePublisher(object):

    def _generate_publish(self, name, exchange):
        # Create producer for the exchange
        exchange_path = "exchange/%s/%s%s" % (
                            self.namespace,
                            self.exchange_prefix,
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

    """
        Base class for pulse publishers.

        All subclasses of this class must define the properties:
          * title
          * description
          * exchange_prefix

        Additional properties of type `Exchange` will be declared as exchanges.
    """

    def __init__(self, namespace, uri, schemas):
        """
        Create publisher, requires a connection_string and a mapping from
        JSON schema uris to JSON schemas.

        :param str: Namespace used when publishing on pulse.
        :param str: URI for pulse.
        :param list: list of available schemas.
        """
        # Validate properties
        assert hasattr(self, 'title'), "Title is required"
        assert hasattr(self, 'description'), "description is required"
        assert hasattr(self, 'exchange_prefix'), "exchange_prefix is required"

        # Set attributes
        self.schemas = schemas
        self.namespace = namespace
        self.exchanges = []
        self.connection = kombu.Connection(uri)

        # Find exchanges
        for name in dir(self):
            exchange = getattr(self, name)
            if isinstance(exchange, Exchange):
                self.exchanges += ((name, exchange),)

        # Wrap exchanges in functions
        for name, exchange in self.exchanges:
            setattr(self, name, self._generate_publish(name, exchange))

    def error(self, error, exchange, routing_key, message):
        logger.error(
            'Error publishing message to {0}'
        ).format(exchange)

    def reference(self):
        """ Construct reference for this publisher"""
        return {
            'version': '0.2.0',
            'title': self.title,
            'description': self.description,
            'exchangePrefix': "exchange/%s/%s" % (
                self.namespace,
                self.exchange_prefix
            ),
            'entries': [ex.reference(name) for name, ex in self.exchanges]
        }
