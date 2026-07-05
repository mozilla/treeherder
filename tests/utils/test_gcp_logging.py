import io
import json
import logging

import pytest

pytest.importorskip("google.cloud.logging_v2")

from treeherder.utils.gcp_logging import ContextLabelStructuredLogHandler
from treeherder.utils.logging_context import log_context


def emit_within_context(**context_labels):
    """Emit one log line through the handler inside a log_context, return its GCP labels."""
    stream = io.StringIO()
    handler = ContextLabelStructuredLogHandler(stream=stream)
    logger = logging.getLogger("test.gcp_logging")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False
    with log_context(**context_labels):
        logger.info("hello world")
    for line in stream.getvalue().splitlines():
        entry = json.loads(line)
        if entry.get("message") == "hello world":
            return entry.get("logging.googleapis.com/labels", {})
    raise AssertionError("log line not found in handler output")


def test_handler_emits_context_labels_as_gcp_labels():
    labels = emit_within_context(task_id="ABC", run_id="0", component="failureline")
    assert labels["task_id"] == "ABC"
    assert labels["run_id"] == "0"
    assert labels["component"] == "failureline"


def test_handler_emits_no_task_labels_without_context():
    stream = io.StringIO()
    handler = ContextLabelStructuredLogHandler(stream=stream)
    logger = logging.getLogger("test.gcp_logging.nolabels")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False
    logger.info("plain message")
    for line in stream.getvalue().splitlines():
        entry = json.loads(line)
        if entry.get("message") == "plain message":
            labels = entry.get("logging.googleapis.com/labels", {})
            assert "task_id" not in labels
            return
    raise AssertionError("log line not found in handler output")
