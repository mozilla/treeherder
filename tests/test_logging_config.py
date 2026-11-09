"""Django ``LOGGING`` output: human-readable and single-line locally, structured in deployments.

Settings are evaluated once at import, so each mode runs in a subprocess with its
own ``TREEHERDER_DEBUG`` value and the real ``treeherder.config.settings``.
"""

import json
import os
import subprocess
import sys

import pytest

EMIT_RECORDS = """
import logging

import django

django.setup()

logging.getLogger("treeherder.example").info("th-record")
logging.getLogger("django.request").warning("Not Found: /missing/")
logging.getLogger("request.summary").info("summary-record")
"""


def run_with_debug(debug):
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "treeherder.config.settings",
        "TREEHERDER_DEBUG": str(debug),
    }
    env.pop("GCP_STRUCTURED_LOGGING", None)
    result = subprocess.run(
        [sys.executable, "-c", EMIT_RECORDS],
        env=env,
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    return (result.stdout + result.stderr).splitlines()


def lines_containing(lines, text):
    return [line for line in lines if text in line]


@pytest.fixture(scope="module")
def debug_output():
    return run_with_debug(True)


@pytest.fixture(scope="module")
def deployed_output():
    return run_with_debug(False)


def test_debug_logs_treeherder_records_as_plain_text(debug_output):
    (line,) = lines_containing(debug_output, "th-record")
    assert "INFO [treeherder.example:" in line
    assert "logging.googleapis.com" not in "\n".join(debug_output)


def test_deployed_logs_treeherder_records_as_gcp_json(deployed_output):
    (line,) = lines_containing(deployed_output, "th-record")
    record = json.loads(line)
    assert record["message"] == "th-record"
    assert record["logging.googleapis.com/labels"]["python_logger"] == "treeherder.example"


@pytest.mark.parametrize("output", ["debug_output", "deployed_output"])
def test_django_request_warnings_are_logged_once(request, output):
    lines = request.getfixturevalue(output)
    assert len(lines_containing(lines, "Not Found: /missing/")) == 1


def test_debug_omits_request_summary(debug_output):
    assert lines_containing(debug_output, "request.summary") == []


def test_deployed_keeps_request_summary(deployed_output):
    assert len(lines_containing(deployed_output, "request.summary")) == 1
