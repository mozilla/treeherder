"""Celery workers must log through Django's ``LOGGING`` config.

Celery's default worker startup installs its own plain-text handler on the root
logger. The ``treeherder`` logger propagates, so every record it emits would be
handled a second time by that handler (and, being non-JSON on stderr, surface in
Cloud Logging as severity ERROR). See bug 2075229.
"""

import logging
import os
import subprocess
import sys

import pytest
from celery.app.log import Logging

from treeherder.celery import app


@pytest.fixture
def fresh_celery_log_setup(monkeypatch):
    """Allow Celery's one-shot logging setup to run again, then undo its effects."""
    monkeypatch.setattr(Logging, "_setup", False)
    root = logging.getLogger()
    celery_logger = logging.getLogger("celery")
    saved = {
        logger: (list(logger.handlers), logger.level, logger.propagate)
        for logger in (root, celery_logger)
    }
    yield
    for logger, (handlers, level, propagate) in saved.items():
        logger.handlers = handlers
        logger.setLevel(level)
        logger.propagate = propagate


def test_worker_log_setup_adds_no_root_handler(fresh_celery_log_setup):
    root = logging.getLogger()
    before = list(root.handlers)

    app.log.setup_logging_subsystem(loglevel=logging.WARNING)

    assert root.handlers == before


def test_worker_log_setup_routes_celery_logs_at_worker_level(fresh_celery_log_setup):
    app.log.setup_logging_subsystem(loglevel=logging.WARNING)

    celery_logger = logging.getLogger("celery")
    assert celery_logger.handlers, "Celery's own records need a handler of their own"
    assert celery_logger.propagate is False
    assert celery_logger.level == logging.WARNING


# Run in a fresh interpreter: by the time this test runs, the task modules are
# already imported, so an import-time ``logging.basicConfig()`` would not fire
# again in-process.
WORKER_STARTUP_SCRIPT = """
import logging

import django

django.setup()

from treeherder.celery import app

# Same order as a real worker: WorkController imports the task modules
# (init_worker) before it configures logging.
app.loader.init_worker()
app.log.setup_logging_subsystem(loglevel=logging.INFO, redirect_stdouts=False)
logging.getLogger("treeherder.log_parser.tasks").info("worker-log-marker")
"""


def test_worker_startup_logs_each_treeherder_record_once():
    """Importing task modules must not attach a handler to the root logger.

    A ``logging.basicConfig()`` in a task module adds a plain-text stderr
    handler to root before Celery's ``setup_logging`` signal fires. Every
    propagating ``treeherder`` record is then printed a second time, which
    Cloud Logging shows as a duplicate entry with severity ERROR.
    """
    result = subprocess.run(
        [sys.executable, "-c", WORKER_STARTUP_SCRIPT],
        capture_output=True,
        text=True,
        env={**os.environ, "DJANGO_SETTINGS_MODULE": "treeherder.config.settings"},
        timeout=120,
    )
    assert result.returncode == 0, result.stderr

    output = result.stdout + result.stderr
    assert output.count("worker-log-marker") == 1, output
