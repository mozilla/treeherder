from kombu import Exchange


def get_exchange(connection, name, create=False):
    """
    Get a Kombu Exchange object using the passed in name.

    Can create an Exchange but this is typically not wanted in production-like
    environments and only useful for testing.
    """
    exchange = Exchange(name, type="topic", passive=not create)

    # bind the exchange to our connection so operations can be performed on it
    bound_exchange = exchange(connection)

    # ensure the exchange exists.  Throw an error if it was created with
    # passive=True and it doesn't exist.
    bound_exchange.declare()

    return bound_exchange
