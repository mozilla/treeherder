from carrot.connection import BrokerConnection
from carrot.messaging import Consumer

from config import PulseConfiguration
from utils import *

from datetime import datetime

import warnings

# Exceptions we can raise
class InvalidTopic(Exception):
    pass

class InvalidAppLabel(Exception):
    pass

class InvalidCallback(Exception):
    pass

class MalformedMessage(Exception):
    pass


# Generic publisher class that specific consumers inherit from
class GenericConsumer(object):

    def __init__(self, config, exchange=None, connect=True, heartbeat=False,
                 **kwargs):
        self.config     = config
        self.exchange   = exchange
        self.connection = None
        self.durable    = False
        self.applabel   = ''
        self.heartbeat  = heartbeat
        for x in ['applabel','topic','callback','durable']:
            if x in kwargs:
                setattr(self, x, kwargs[x])
                del kwargs[x]

        if connect:
            self.connect()

    # Sets vairables
    def configure(self, **kwargs):
        for x in kwargs:
            setattr(self, x, kwargs[x])

    # Connect to the message broker
    def connect(self):
        if not self.connection:
            self.connection = BrokerConnection(hostname=self.config.host,
                                               port=self.config.port,
                                               userid=self.config.user,
                                               password=self.config.password,
                                               virtual_host=self.config.vhost)

    # Disconnect from the message broker
    def disconnect(self):
        if self.connection:
            self.connection.close()

    # Support purging messages that are already in the queue on the broker
    # TODO: I think this is only supported by the amqp backend
    def purge_existing_messages(self):

        # Make sure there is an applabel given
        if self.durable and not self.applabel:
            raise InvalidAppLabel('Durable consumers must have an applabel')
        
        # Purge the queue of existing messages
        self.connection.create_backend().queue_purge(self.applabel)

    # Blocks and calls the callback when a message comes into the queue
    # For info on one script listening to multiple channels, see
    # http://ask.github.com/carrot/changelog.html#id1
    def listen(self, callback=None):

        # One can optionally provide a callback to listen (if it wasn't already)
        if callback:
            self.callback = callback

        # Make suere there is an exchange given
        if not self.exchange:
            raise InvalidExchange(self.exchange)

        # Make sure there is a topic given
        if not self.topic:
            raise InvalidTopic(self.topic)

        # Make sure there is an applabel given
        if self.durable and not self.applabel:
            raise InvalidAppLabel('Durable consumers must have an applabel')

        # Make sure there is a callback given
        if not self.callback or not hasattr(self.callback, '__call__'):
            raise InvalidCallback(self.callback)

        # Connect to the broker if we haven't already
        if not self.connection:
            self.connect()

        # Set up our broker consumer
        self.consumer = Consumer(connection=self.connection,
                                   queue=self.applabel,
                                   exchange=self.exchange,
                                   exchange_type="topic",
                                   auto_declare=False,
                                   routing_key=self.topic)

        # We need to manually create / declare the queue
        self.consumer.backend.queue_declare(queue=self.applabel,
                                            durable=self.durable,
                                            exclusive=False,
                                            auto_delete=not self.durable,
                                            arguments=self.consumer.queue_arguments,
                                            warn_if_exists=False)

        # No need to manually create the exchange, as the producer creates it
        # and we expect it to just be there

        # We support multiple bindings if we were given an array for the topic
        if not isinstance(self.topic, list):
            self.topic = [self.topic]

        # We need to bind the queue to the exchange with the specified keys
        if self.consumer.queue:
            for routing_key in self.topic:
                self.consumer.backend.queue_bind(queue=self.consumer.queue,
                                                 exchange=self.exchange,
                                                 routing_key=routing_key)
            if self.heartbeat:
                self.consumer.backend.queue_bind(queue=self.consumer.queue,
                                                 exchange='org.mozilla.exchange.pulse.test',
                                                 routing_key='heartbeat')

        # Register the callback the user wants
        self.consumer.register_callback(self.callback)

        # This blocks, and then calls the user callback every time a message 
        # comes in
        self.consumer.wait()

        # Likely never get here but can't hurt
        self.disconnect()

# ------------------------------------------------------------------------------
# Consumers for various topics
# ------------------------------------------------------------------------------

class PulseTestConsumer(GenericConsumer):
    
    def __init__(self, **kwargs):
        super(PulseTestConsumer, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.pulse.test', **kwargs)

class PulseMetaConsumer(GenericConsumer):
    
    def __init__(self, **kwargs):
        super(PulseMetaConsumer, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.pulse', **kwargs)

class BugzillaConsumer(GenericConsumer):
    
    def __init__(self, **kwargs):
        super(BugzillaConsumer, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.bugzilla', **kwargs)

class CodeConsumer(GenericConsumer):
    
    def __init__(self, **kwargs):
        super(CodeConsumer, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.code', **kwargs)

class HgConsumer(CodeConsumer):
    
    def __init__(self, **kwargs):
        pass
        #super(CodeConsumer, self).__init__(PulseConfiguration(**kwargs), 'hg.push.mozilla.central', **kwargs)

class BuildConsumer(GenericConsumer):
    
    def __init__(self, **kwargs):
        super(BuildConsumer, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.build', **kwargs)

class NormalizedBuildConsumer(GenericConsumer):

    def __init__(self, **kwargs):
        super(NormalizedBuildConsumer, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.build.normalized', **kwargs)

class QAConsumer(GenericConsumer):
    
    def __init__(self, **kwargs):
        super(QAConsumer, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.qa', **kwargs)
