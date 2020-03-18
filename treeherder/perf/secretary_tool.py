import logging
import simplejson as json

from datetime import datetime, timedelta
from treeherder.perf.models import PerformanceSettings
from django.conf import settings as django_settings

logger = logging.getLogger(__name__)

# TODO: extract strings into constants


class SecretaryTool:
    """
    Tool used for doing the secretary work in the Performance Sheriff Bot.
    """

    def __init__(self):
        pass

    @staticmethod
    def manage_settings():
        perf_sheriff_settings, created = PerformanceSettings.objects.get_or_create(
            name="perf_sheriff_bot",
            defaults={"settings": SecretaryTool._get_default_settings()},
        )

        if created:
            logger.info("Performance settings for perf_sheriff_bot not found. Creating with defaults...")

        settings = json.loads(perf_sheriff_settings.settings)
        # reset limits if the settings expired
        if SecretaryTool.is_expired(datetime.fromisoformat(settings["last_reset_date"])):
            perf_sheriff_settings.settings = SecretaryTool._get_default_settings()
            perf_sheriff_settings.save()

    @staticmethod
    def is_expired(last_reset_date):
        return datetime.utcnow() > last_reset_date + django_settings.RESET_BACKFILL_LIMITS

    @staticmethod
    def _get_default_settings(as_json=True):
        default_settings = {
            "limits": django_settings.MAX_BACKFILLS_PER_PLATFORM,
            "last_reset_date": datetime.utcnow(),
        }

        return json.dumps(default_settings, default=default_serializer) if as_json else default_settings


def default_serializer(val):
    if isinstance(val, datetime):
        return val.isoformat()
