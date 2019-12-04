import pytest
from kombu import Exchange

from tests.conftest import IS_WINDOWS
from treeherder.services.pulse.exchange import get_exchange

from .utils import create_and_destroy_exchange


@pytest.mark.skipif(IS_WINDOWS, reason="celery does not work on windows")
def test_get_existing_exchange(pulse_connection):
    with create_and_destroy_exchange(pulse_connection, "foobar"):
        # shouldn't throw an error about a non-existant connection
        get_exchange(pulse_connection, "foobar")


@pytest.mark.skipif(IS_WINDOWS, reason="celery does not work on windows")
def test_get_new_exchange(pulse_connection):
    """Test we can create a new exchange on the given connection."""
    exchange = get_exchange(pulse_connection, "new_exchange", create=True)

    assert isinstance(exchange, Exchange)
    assert exchange.name == "new_exchange"
