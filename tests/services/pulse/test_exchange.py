import pytest
from kombu import Exchange

from tests.conftest import IS_WINDOWS
from treeherder.services.pulse.exchange import get_exchange

from .utils import create_and_destroy_exchange


@pytest.mark.skipif(IS_WINDOWS, reason="celery does not work on windows")
def test_get_existing_exchange(pulse_connection):
    """Test retrieving an already existing exchange from the connection."""
    with create_and_destroy_exchange(pulse_connection, "foobar"):
        # shouldn't throw an error about a non-existant connection
        get_exchange(pulse_connection, "foobar")


@pytest.mark.skipif(IS_WINDOWS, reason="celery does not work on windows")
def test_get_new_exchange(pulse_connection):
    """Test we can create a new exchange on the given connection."""
    exchange = get_exchange(pulse_connection, "new_exchange", create=True)

    assert isinstance(exchange, Exchange)
    assert exchange.name == "new_exchange"


def test_get_non_existent_exchange_fails(pulse_connection):
    """Test that declaring a non-existent exchange with create=False fails."""
    # Since passive=True is set when create=False, get_exchange should raise an exception
    # when trying to declare an exchange that has not been created.
    with pytest.raises(Exception):
        get_exchange(pulse_connection, "non_existent_exchange", create=False)
