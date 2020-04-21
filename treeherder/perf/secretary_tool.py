import logging
from datetime import datetime, timedelta

import simplejson as json
from django.conf import settings as django_settings

from treeherder.perf.models import BackfillRecord, BackfillReport, PerformanceSettings

logger = logging.getLogger(__name__)


# TODO: update the backfill status using data
class SecretaryTool:
    """
    Tool used for doing the secretary work in the Performance Sheriff Bot.
    """

    TIME_TO_MATURE = timedelta(hours=4)

    def __init__(self):
        pass

    @classmethod
    def validate_settings(cls):
        perf_sheriff_settings, created = PerformanceSettings.objects.get_or_create(
            name="perf_sheriff_bot", defaults={"settings": cls._get_default_settings()},
        )

        if created:
            logger.info(
                "Performance settings for perf_sheriff_bot not found. Creating with defaults."
            )
            return

        # reset limits if the settings expired
        settings = json.loads(perf_sheriff_settings.settings)
        if cls.are_expired(settings):
            logger.info(f"Settings are expired. Expired settings: {settings}")

            perf_sheriff_settings.settings = cls._get_default_settings()
            perf_sheriff_settings.save()

    @classmethod
    def mark_reports_for_backfill(cls):
        # get the backfill reports that are mature, but not frozen
        mature_date_limit = datetime.utcnow() - cls.TIME_TO_MATURE
        mature_reports = BackfillReport.objects.filter(
            frozen=False, last_updated__lte=mature_date_limit
        )

        for report in mature_reports:
            should_freeze = False
            for record in report.records.all():
                if record.status == BackfillRecord.PRELIMINARY:
                    record.status = BackfillRecord.READY_FOR_PROCESSING
                    record.save()
                    should_freeze = True

            if should_freeze:
                report.frozen = True
                report.save()

    @classmethod
    def are_expired(cls, settings):
        last_reset_date = datetime.fromisoformat(settings["last_reset_date"])
        return datetime.utcnow() > last_reset_date + django_settings.RESET_BACKFILL_LIMITS

    @classmethod
    def _get_default_settings(cls, as_json=True):
        default_settings = {
            "limits": django_settings.MAX_BACKFILLS_PER_PLATFORM,
            "last_reset_date": datetime.utcnow(),
        }

        return (
            json.dumps(default_settings, default=default_serializer)
            if as_json
            else default_settings
        )


def default_serializer(val):
    if isinstance(val, datetime):
        return val.isoformat()
