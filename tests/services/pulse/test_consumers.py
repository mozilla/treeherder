import pytest
from django.conf import settings

from tests.conftest import IS_WINDOWS
from treeherder.services.pulse.consumers import (Consumers,
                                                 PulseConsumer)

from .utils import create_and_destroy_exchange


def test_Consumers():
    class TestConsumer:

        def prepare(self):
            self.prepared = True

        def run(self):
            self.ran = True

    cons1 = TestConsumer()
    cons2 = TestConsumer()

    cons = Consumers([cons1, cons2])
    cons.run()

    assert cons1.prepared
    assert cons1.ran
    assert cons2.prepared
    assert cons2.ran


@pytest.mark.skipif(IS_WINDOWS, reason="celery does not work on windows")
def test_PulseConsumer(pulse_connection):
    class TestConsumer(PulseConsumer):
        queue_suffix = "test"

        def bindings(self):
            return ["foobar"]

        def on_message(self, body, message):
            pass

    with create_and_destroy_exchange(pulse_connection, "foobar"):
        cons = TestConsumer({"root_url": "https://firefox-ci-tc.services.mozilla.com", "pulse_url": settings.CELERY_BROKER_URL}, None)
        cons.prepare()
