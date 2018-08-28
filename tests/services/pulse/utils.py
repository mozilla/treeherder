import contextlib

from treeherder.services.pulse.exchange import get_exchange


@contextlib.contextmanager
def create_and_destroy_exchange(connection, name):
    """
    Simple context manager to create and delete an Exchange

    Primarily used with testing this is allows a user to create an Exchange
    with the given name using the given connection and know it will be
    destroyed when the context manager exits.

    This has been implemented as a context manager as creating both a yielding
    fixture and a fixture which takes an argument appears to not be possible
    with pytest.
    """
    exchange = get_exchange(connection, name, create=True)
    yield exchange
    exchange.delete()
