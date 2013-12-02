from carrot.connection import BrokerConnection
from carrot.messaging import Publisher

from config import PulseConfiguration
from utils import *

from datetime import datetime
from pytz import timezone

import warnings

# Exceptions we can raise
class InvalidExchange(Exception):
    pass

class MalformedMessage(Exception):
    pass


# Generic publisher class that specific publishers inherit from
class GenericPublisher(object):

    def __init__(self, config, exchange=None, connect=True):
        self.config = config
        self.exchange = exchange
        self.connection = None
        if connect:
            self.connect()

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
            self.connection = None

    # Used to publish a pulse message to the proper exchange
    def publish(self, message):

        # Make suere there is an exchange given
        if not self.exchange:
            raise InvalidExchange(self.exchange)

        # Make sure there is a message given
        if not message:
            raise MalformedMessage(message)

        # Have the message prepare and validate itself
        message._prepare()

        # Connect to the broker if we haven't already
        if not self.connection:
            self.connect()

        # Set up our broker publisher
        self.publisher = Publisher(connection=self.connection,
                                   exchange=self.exchange,
                                   exchange_type="topic",
                                   routing_key=message.routing_key)

        # The message is actually a simple envelope format with a payload and
        # some metadata
        final_data = {}
        final_data['payload'] = message.data
        final_data['_meta'] = message.metadata.copy()
        final_data['_meta'].update({
            'exchange': self.exchange,
            'routing_key': message.routing_key,
            'serializer': self.config.serializer,
            'sent': time_to_string(datetime.now(timezone(self.config.broker_timezone)))
        })

        # Send the message
        self.publisher.send(final_data, serializer=self.config.serializer)

        # Close the publishing connection
        self.publisher.close()

# ------------------------------------------------------------------------------
# Publishers for various exchanges
# ------------------------------------------------------------------------------

class PulseTestPublisher(GenericPublisher):
    
    def __init__(self, **kwargs):
        super(PulseTestPublisher, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.pulse.test')

class PulseMetaPublisher(GenericPublisher):
    
    def __init__(self, **kwargs):
        super(PulseMetaPublisher, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.pulse')

class BugzillaPublisher(GenericPublisher):
    
    def __init__(self, **kwargs):
        super(BugzillaPublisher, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.bugzilla')

class CodePublisher(GenericPublisher):
    
    def __init__(self, **kwargs):
        super(CodePublisher, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.code')

class HgPublisher(CodePublisher):
    
    def __init__(self, **kwargs):
        super(HgPublisher, self).__init__(PulseConfiguration(**kwargs))
        warnings.warn('HgPublisher is now CodePublisher', DeprecationWarning)

class BuildPublisher(GenericPublisher):

    def __init__(self, **kwargs):
        super(BuildPublisher, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.build')

class QAPublisher(GenericPublisher):

    def __init__(self, **kwargs):
        super(QAPublisher, self).__init__(PulseConfiguration(**kwargs), 'org.mozilla.exchange.qa')
