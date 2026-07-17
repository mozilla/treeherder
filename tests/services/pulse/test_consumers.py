from unittest.mock import MagicMock

import pytest
from django.conf import settings

from tests.conftest import IS_WINDOWS
from treeherder.etl.tasks.pulse_tasks import (
    store_pulse_pushes,
    store_pulse_tasks,
    store_pulse_tasks_classification,
)
from treeherder.services.pulse.consumers import (
    GITHUB_PUSH_BINDINGS,
    HGMO_PUSH_BINDINGS,
    MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS,
    MOZCI_CLASSIFICATION_TESTING_BINDINGS,
    TASKCLUSTER_TASK_BINDINGS,
    Consumers,
    JointConsumer,
    MozciClassificationConsumer,
    PulseConsumer,
    PushConsumer,
    TaskConsumer,
    prepare_consumers,
    prepare_joint_consumers,
)
from treeherder.services.pulse.exchange import get_exchange

from .utils import create_and_destroy_exchange


def test_consumers():
    """Test parallel consumers run setup and start threads as expected."""

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
    """Test PulseConsumer setup prepares connection and exchange."""

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
    """Test JointConsumer on_message does not trigger mozci classification if not a mozci task."""
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
    """Test JointConsumer on_message triggers mozci classification task when routing key matches."""
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


class DummyPulseConsumer(PulseConsumer):
    queue_suffix = "dummy"

    def on_message(self, body, message):
        pass


def test_pulse_consumer_bindings_default():
    """Test base PulseConsumer returns empty bindings by default."""
    cons = DummyPulseConsumer(
        {
            "root_url": "https://firefox-ci-tc.services.mozilla.com",
            "pulse_url": "memory://",
        },
        None,
    )
    assert cons.bindings() == []


def test_get_consumers():
    """Test that get_consumers instantiates a consumer object for each configured config dict."""
    cons = DummyPulseConsumer(
        {
            "root_url": "https://firefox-ci-tc.services.mozilla.com",
            "pulse_url": "memory://",
        },
        None,
    )
    cons.consumers = [{"key": "value"}]
    mock_consumer_class = MagicMock()
    cons.get_consumers(mock_consumer_class, None)
    mock_consumer_class.assert_called_once_with(key="value")


def test_pulse_consumer_bind_and_unbind(pulse_connection, monkeypatch):
    """Test PulseConsumer can bind, re-bind, unbind, and close connection."""
    cons = DummyPulseConsumer(
        {
            "root_url": "https://firefox-ci-tc.services.mozilla.com",
            "pulse_url": "memory://",
        },
        None,
    )
    # Bind
    exchange = get_exchange(pulse_connection, "test_exchange", create=True)
    binding = cons.bind_to(exchange, "test_routing_key")
    assert binding == "test_exchange test_routing_key"
    assert len(cons.consumers) == 1

    # Call bind_to again (exercise the 'else' branch of 'if not self.queue:')
    mock_bind = MagicMock()
    monkeypatch.setattr(cons.queue, "bind_to", mock_bind)
    cons.bind_to(exchange, "another_key")
    mock_bind.assert_called_once_with(exchange=exchange, routing_key="another_key")

    # Unbind
    mock_unbind = MagicMock()
    monkeypatch.setattr(cons.queue, "unbind_from", mock_unbind)
    cons.unbind_from(exchange, "test_routing_key")
    mock_unbind.assert_called_once_with(exchange, "test_routing_key")

    # Close
    mock_release = MagicMock()
    monkeypatch.setattr(cons.connection, "release", mock_release)
    cons.close()
    mock_release.assert_called_once()


def test_pulse_consumer_prune_bindings(pulse_connection, monkeypatch):
    """Test PulseConsumer correctly prunes stale bindings."""
    cons = DummyPulseConsumer(
        {
            "root_url": "https://firefox-ci-tc.services.mozilla.com",
            "pulse_url": "memory://",
        },
        None,
    )
    exchange = get_exchange(pulse_connection, "test_exchange", create=True)
    cons.bind_to(exchange, "new_key")

    # Case 1: get_bindings succeeds and has an old binding to prune
    mock_fetch = MagicMock(
        return_value={
            "bindings": [
                {"source": "test_exchange", "routing_key": "new_key"},
                {"source": "test_exchange", "routing_key": "old_key"},
            ]
        }
    )
    monkeypatch.setattr("treeherder.services.pulse.consumers.fetch_json", mock_fetch)

    mock_unbind = MagicMock()
    monkeypatch.setattr(cons, "unbind_from", mock_unbind)

    cons.prune_bindings(["test_exchange new_key"])
    mock_unbind.assert_called_once()

    # Case 2: get_bindings raises an exception (should handle and log error but not crash)
    mock_fetch.side_effect = Exception("HTTP error")
    cons.prune_bindings(["test_exchange new_key"])  # should not raise an error


def test_pulse_consumer_prepare(pulse_connection, monkeypatch):
    """Test prepare method sets up all routing key bindings and prunes stale ones."""

    class SimpleConsumer(PulseConsumer):
        queue_suffix = "simple"

        def bindings(self):
            return ["test_exchange.key1:key2"]

        def on_message(self, body, message):
            pass

    cons = SimpleConsumer(
        {
            "root_url": "https://firefox-ci-tc.services.mozilla.com",
            "pulse_url": "memory://",
        },
        build_routing_key=lambda r: f"prefix.{r}",
    )

    # Mock get_exchange to return a dummy exchange
    monkeypatch.setattr(
        "treeherder.services.pulse.consumers.get_exchange", lambda conn, name: MagicMock(name=name)
    )

    # Mock bind_to and prune_bindings
    bound_keys = []
    monkeypatch.setattr(
        cons, "bind_to", lambda exchange, key: bound_keys.append(key) or f"{exchange.name} {key}"
    )
    monkeypatch.setattr(cons, "prune_bindings", lambda bindings: None)

    cons.prepare()
    assert bound_keys == ["prefix.key1", "prefix.key2"]


def test_task_consumer(monkeypatch):
    """Test TaskConsumer bindings and asynchronous task routing logic on message receipt."""
    cons = TaskConsumer({"root_url": "https://foo.com", "pulse_url": "memory://"}, None)
    assert cons.bindings() == TASKCLUSTER_TASK_BINDINGS

    mock_apply = MagicMock()
    monkeypatch.setattr(store_pulse_tasks, "apply_async", mock_apply)

    message = MagicMock()
    message.delivery_info = {"exchange": "ex", "routing_key": "rk"}
    cons.on_message("my-body", message)
    mock_apply.assert_called_once_with(
        args=["my-body", "ex", "rk", "https://foo.com"], queue="store_pulse_tasks"
    )
    message.ack.assert_called_once()


def test_mozci_classification_consumer(monkeypatch):
    """Test MozciClassificationConsumer environment configurations and message routing."""
    # Default production env
    cons = MozciClassificationConsumer(
        {"root_url": "https://foo.com", "pulse_url": "memory://"}, None
    )
    assert cons.bindings() == MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS

    # Testing env
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", "testing")
    assert cons.bindings() == MOZCI_CLASSIFICATION_TESTING_BINDINGS

    # Invalid env (should log warning but default to production)
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", "invalid")
    assert cons.bindings() == MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS

    # on_message
    mock_apply = MagicMock()
    monkeypatch.setattr(store_pulse_tasks_classification, "apply_async", mock_apply)

    message = MagicMock()
    message.delivery_info = {"exchange": "ex", "routing_key": "rk"}
    cons.on_message("my-body", message)
    mock_apply.assert_called_once_with(
        args=["my-body", "ex", "rk", "https://foo.com"], queue="store_pulse_tasks_classification"
    )
    message.ack.assert_called_once()


def test_push_consumer(monkeypatch):
    """Test PushConsumer bindings conditionally active for hgmo and github source types."""
    # Both hgmo and github disabled
    cons = PushConsumer(
        {"root_url": "https://foo.com", "pulse_url": "memory://", "hgmo": False, "github": False},
        None,
    )
    assert cons.bindings() == []

    # hgmo enabled
    cons_hg = PushConsumer(
        {"root_url": "https://foo.com", "pulse_url": "memory://", "hgmo": True, "github": False},
        None,
    )
    assert cons_hg.bindings() == HGMO_PUSH_BINDINGS

    # github enabled
    cons_git = PushConsumer(
        {"root_url": "https://foo.com", "pulse_url": "memory://", "hgmo": False, "github": True},
        None,
    )
    assert cons_git.bindings() == GITHUB_PUSH_BINDINGS

    # both enabled
    cons_both = PushConsumer(
        {"root_url": "https://foo.com", "pulse_url": "memory://", "hgmo": True, "github": True},
        None,
    )
    assert cons_both.bindings() == HGMO_PUSH_BINDINGS + GITHUB_PUSH_BINDINGS

    # on_message
    mock_apply = MagicMock()
    monkeypatch.setattr(store_pulse_pushes, "apply_async", mock_apply)

    message = MagicMock()
    message.delivery_info = {"exchange": "ex", "routing_key": "rk"}
    cons_both.on_message("my-body", message)
    mock_apply.assert_called_once_with(
        args=["my-body", "ex", "rk", "https://foo.com"], queue="store_pulse_pushes"
    )
    message.ack.assert_called_once()


def test_joint_consumer_bindings(monkeypatch):
    """Test JointConsumer bindings collection based on enabled flags in source."""
    # Test various branches in JointConsumer.bindings()
    # 1. hgmo and github
    cons1 = JointConsumer(
        {"hgmo": True, "github": True, "pulse_url": "memory://", "root_url": "https://foo.com"},
        None,
    )
    assert cons1.bindings() == HGMO_PUSH_BINDINGS + GITHUB_PUSH_BINDINGS

    # 2. tasks
    cons2 = JointConsumer(
        {"tasks": True, "pulse_url": "memory://", "root_url": "https://foo.com"}, None
    )
    assert cons2.bindings() == TASKCLUSTER_TASK_BINDINGS

    # 3. mozci-classification testing env
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", "testing")
    cons3 = JointConsumer(
        {"mozci-classification": True, "pulse_url": "memory://", "root_url": "https://foo.com"},
        None,
    )
    assert cons3.bindings() == MOZCI_CLASSIFICATION_TESTING_BINDINGS

    # 4. mozci-classification production env
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", "production")
    cons4 = JointConsumer(
        {"mozci-classification": True, "pulse_url": "memory://", "root_url": "https://foo.com"},
        None,
    )
    assert cons4.bindings() == MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS

    # 5. mozci-classification invalid env (should fallback to production)
    monkeypatch.setenv("PULSE_MOZCI_ENVIRONMENT", "invalid")
    cons5 = JointConsumer(
        {"mozci-classification": True, "pulse_url": "memory://", "root_url": "https://foo.com"},
        None,
    )
    assert cons5.bindings() == MOZCI_CLASSIFICATION_PRODUCTION_BINDINGS


def test_joint_consumer_on_message_non_taskcluster(monkeypatch):
    """Test JointConsumer routes push-related messages correctly."""
    # If exchange is NOT taskcluster-queue, it calls store_pulse_pushes
    mock_store_pulse_pushes = MagicMock()
    monkeypatch.setattr(store_pulse_pushes, "apply_async", mock_store_pulse_pushes)

    cons = JointConsumer({"root_url": "https://foo.com", "pulse_url": "memory://"}, None)
    message = MagicMock()
    message.delivery_info = {"exchange": "exchange/hgpushes/v1", "routing_key": "rk"}
    cons.on_message("body", message)

    mock_store_pulse_pushes.assert_called_once_with(
        args=["body", "exchange/hgpushes/v1", "rk", "https://foo.com"], queue="store_pulse_pushes"
    )
    message.ack.assert_called_once()


def test_consumers_runner():
    """Test Consumers runner triggers prepare and executes thread routines."""
    # Test real execution thread spawn and join
    mock_prepare = MagicMock()
    mock_run = MagicMock()

    class DummyConsumer:
        def prepare(self):
            mock_prepare()

        def run(self):
            mock_run()

    cons = Consumers([DummyConsumer(), DummyConsumer()])
    cons.run()

    assert mock_prepare.call_count == 2
    assert mock_run.call_count == 2


def test_prepare_consumers_factory():
    """Test prepare_consumers factory correctly initializes Consumers container with list of class instances."""

    class DummyConsumerClass:
        def __init__(self, source, build_routing_key):
            self.source = source
            self.build_routing_key = build_routing_key

    consumers_obj = prepare_consumers(DummyConsumerClass, [{"src": 1}], "key")
    assert isinstance(consumers_obj, Consumers)
    assert len(consumers_obj.consumers) == 1
    assert consumers_obj.consumers[0].source == {"src": 1}
    assert consumers_obj.consumers[0].build_routing_key == "key"


def test_prepare_joint_consumers_factory():
    """Test prepare_joint_consumers factory correctly unpacks tuple arguments and instantiates consumers."""

    class DummyConsumerClass:
        def __init__(self, source, build_routing_key):
            self.source = source
            self.build_routing_key = build_routing_key

    listening_params = (DummyConsumerClass, [{"src": 2}], ["key2"])
    consumers_obj = prepare_joint_consumers(listening_params)
    assert isinstance(consumers_obj, Consumers)
    assert len(consumers_obj.consumers) == 1
    assert consumers_obj.consumers[0].source == {"src": 2}
    assert consumers_obj.consumers[0].build_routing_key == "key2"
