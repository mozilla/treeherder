import logging
import os
from logging.config import dictConfig

from celery import Celery
from celery.signals import setup_logging

# set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "treeherder.config.settings")

app = Celery("treeherder")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()
app.autodiscover_tasks(["treeherder.workers.stats"])


@setup_logging.connect
def configure_logging(loglevel=None, **kwargs):
    """Make Celery processes log through Django's ``LOGGING`` config.

    Connecting this signal stops Celery from installing its own plain-text
    handler on the root logger. With that handler in place every record from
    the propagating ``treeherder`` logger was emitted twice: once as structured
    JSON and once as plain text on stderr, which Cloud Logging reports as
    severity ERROR regardless of the record's level (bug 2075229).

    Celery's own loggers (``celery``, ``celery.task``, ...) are routed by the
    ``celery`` entry in ``LOGGING``; the worker's ``--loglevel`` still applies
    to them so framework chatter stays as quiet as before.
    """
    from django.conf import settings

    dictConfig(settings.LOGGING)
    if loglevel is not None:
        logging.getLogger("celery").setLevel(loglevel)
