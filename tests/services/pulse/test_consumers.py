from unittest.mock import MagicMock
import pytest
from django.conf import settings

from tests.conftest import IS_WINDOWS
from treeherder.etl.tasks.pulse_tasks import store_pulse_tasks, store_pulse_tasks_classification
from treeherder.services.pulse.consumers import Consumers, JointConsumer, PulseConsumer

from .utils import create_and_destroy_exchange


def test_consumers():
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
def test_pulse_consumer(pulse_connection):
    class TestConsumer(PulseConsumer):
        queue_suffix = "test"

        def bindings(self):
            return ["foobar"]

        def on_message(self, body, message):
            pass

    with create_and_destroy_exchange(pulse_connection, "foobar"):
        cons = TestConsumer(
            {
                "root_url": "https://firefox-ci-tc.services.mozilla.com",
                "pulse_url": settings.CELERY_BROKER_URL,
            },
            None,
        )
        cons.prepare()


def test_joint_consumer_on_message_do_not_call_classification_ingestion(monkeypatch):
    mock_called = False

    def mock_store_pulse_tasks_classification(args, queue):
        nonlocal mock_called
        mock_called = True

    monkeypatch.setattr(store_pulse_tasks, "apply_async", lambda args, queue: None)
    monkeypatch.setattr(
        store_pulse_tasks_classification, "apply_async", mock_store_pulse_tasks_classification
    )

    consumer = JointConsumer(
        {
            "root_url": "https://community-tc.services.mozilla.com",
            "vhost": "communitytc",
            "mozci-classification": True,
            "pulse_url": settings.CELERY_BROKER_URL,
        },
        None,
    )

    message = MagicMock()
    monkeypatch.setattr(
        message,
        "delivery_info",
        {
            "exchange": "exchange/taskcluster-queue/v1/task-completed",
            "routing_key": "primary.aaaaaaaaaaaaaaaaaaaaaa.0.us-east1.111111111111111111.proj-bugbug.compute-smaller.-.AAAAAAAAAAAAAAAAAAAAAA._",
        },
    )
    consumer.on_message(None, message)

    assert not mock_called


def test_joint_consumer_on_message_call_classification_ingestion(monkeypatch):
    mock_called = False

    def mock_store_pulse_tasks_classification(args, queue):
        nonlocal mock_called
        mock_called = True

    monkeypatch.setattr(store_pulse_tasks, "apply_async", lambda args, queue: None)
    monkeypatch.setattr(
        store_pulse_tasks_classification, "apply_async", mock_store_pulse_tasks_classification
    )

    consumer = JointConsumer(
        {
            "root_url": "https://community-tc.services.mozilla.com",
            "vhost": "communitytc",
            "mozci-classification": True,
            "pulse_url": settings.CELERY_BROKER_URL,
        },
        None,
    )

    message = MagicMock()
    monkeypatch.setattr(
        message,
        "delivery_info",
        {
            "exchange": "exchange/taskcluster-queue/v1/task-completed",
            "routing_key": "primary.aaaaaaaaaaaaaaaaaaaaaa.0.us-east1.111111111111111111.proj-mozci.compute-smaller.-.AAAAAAAAAAAAAAAAAAAAAA._",
        },
    )
    consumer.on_message(None, message)

    assert mock_called
