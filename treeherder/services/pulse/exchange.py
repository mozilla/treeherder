from kombu import Exchange


def get_exchange(connection, name):
    """Get a Kombu Exchange object using the passed in name."""
    # When creating this exchange object, it is important that it be set to
    # ``passive=True``.  This will prevent any attempt by Kombu to actually
    # create the exchange.
    exchange = Exchange(name, type="topic", passive=True)

    # ensure the exchange exists.  Throw an error if it doesn't
    exchange(connection).declare()

    return exchange
