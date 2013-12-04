# Custom exceptions
class InvalidRoutingKey(Exception):
    pass

class MalformedMessage(Exception):
    pass

# Base class that other objects should inherit from
class GenericMessage(object):
    
    def __init__(self, routing_key=None):
        self.routing_parts = []
        self.routing_key = routing_key
        self.data = {}
        self.metadata = {}

    # Setter for data items
    def set_data(self, key, value=None):
        self.data[key] = value

    # Subclasses can override to generate the key from stored data
    def _prepare_routing_key(self):
        self.routing_key = '.'.join(self.routing_parts)

    # Subclasses can override to define data fields that should be non-empty
    def _required_data_fields(self):
        return []

    # Check that required data fields are non-empty by default
    # Subclasses should override this with message-specific logic and then call
    # super to get this default validation
    def _validate(self):
        for field in self._required_data_fields():
            if field not in self.data or not self.data[field]:
                raise MalformedMessage('Missing required field: %s' % field)

    # Called right before the message is sent
    def _prepare(self):
        
        # Fill out the routing key (if needed)
        self._prepare_routing_key()
        
        # Check for a blank routing key
        if not self.routing_key:
            raise InvalidRoutingKey(self.routing_key)

        # Check for a routing key that has two periods in a row
        if self.routing_key.count('..'):
            raise InvalidRoutingKey(self.routing_key)

        # Make sure the message iteself is well-formed
        self._validate()

    # Pretty printing
    def __str__(self):
        return u'%s instance: %s: %s' % (self.__class__, self.routing_key, self.data)
