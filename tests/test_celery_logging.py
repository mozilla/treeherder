"""Celery workers must log through Django's ``LOGGING`` config.

Celery's default worker startup installs its own plain-text handler on the root
logger. The ``treeherder`` logger propagates, so every record it emits would be
handled a second time by that handler (and, being non-JSON on stderr, surface in
Cloud Logging as severity ERROR). See bug 2075229.
"""

import logging

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
