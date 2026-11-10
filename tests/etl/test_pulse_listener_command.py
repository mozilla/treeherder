from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError


def test_pulse_listener_skips_when_skip_ingestion_set(monkeypatch):
    monkeypatch.setenv("SKIP_INGESTION", "True")
    monkeypatch.delenv("PULSE_URL", raising=False)
    out = StringIO()

    with patch("treeherder.etl.management.commands.pulse_listener.prepare_joint_consumers") as prep:
        call_command("pulse_listener", stdout=out)

    prep.assert_not_called()
    assert "Skipping ingestion" in out.getvalue()


@pytest.mark.parametrize("pulse_url", [None, ""])
def test_pulse_listener_errors_without_pulse_url(monkeypatch, pulse_url):
    monkeypatch.delenv("SKIP_INGESTION", raising=False)
    monkeypatch.delenv("PULSE_SOURCES", raising=False)
    if pulse_url is None:
        monkeypatch.delenv("PULSE_URL", raising=False)
    else:
        monkeypatch.setenv("PULSE_URL", pulse_url)

    with pytest.raises(CommandError, match="PULSE_URL is not set"):
        call_command("pulse_listener")


def test_pulse_listener_builds_sources_from_pulse_url(monkeypatch):
    monkeypatch.delenv("SKIP_INGESTION", raising=False)
    monkeypatch.delenv("PULSE_SOURCES", raising=False)
    monkeypatch.setenv("PULSE_URL", "amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1")

    with patch("treeherder.etl.management.commands.pulse_listener.prepare_joint_consumers") as prep:
        call_command("pulse_listener")

    (listener_params,) = prep.call_args[0]
    _consumer_cls, sources, _keys = listener_params
    assert [s["pulse_url"] for s in sources] == [
        "amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1",
        "amqp://foo:bar@pulse.mozilla.org:5671/?ssl=1",
    ]
    assert [s["vhost"] for s in sources] == ["/", "communitytc"]
    prep.return_value.run.assert_called_once()
