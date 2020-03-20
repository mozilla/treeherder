import datetime
import logging

from django.db import transaction

from treeherder.changelog.collector import collect
from treeherder.changelog.models import (Changelog,
                                         ChangelogFile)

logger = logging.getLogger(__name__)


def update_changelog(days=1):
    """
    Collect changes and update the DB.
    """
    logger.info("Updating unified changelog (days=%d)" % days)
    # collecting last day of changes across all sources
    since = datetime.datetime.now() - datetime.timedelta(days=days)
    since = since.strftime("%Y-%m-%dT%H:%M:%S")

    created = 0
    existed = 0

    with transaction.atomic():
        for entry in collect(since):
            files = entry.pop("files", [])
            # lame hack to remove TZ awareness
            if entry["date"].endswith("Z"):
                entry["date"] = entry["date"][:-1]
            changelog, line_created = Changelog.objects.update_or_create(**entry)
            if not line_created:
                existed += 1
                continue
            created += 1
            [
                ChangelogFile.objects.create(name=name, changelog=changelog)
                for name in files
            ]

    logger.info("Found %d items, %d existed and %d where created." % (
                created + existed, existed, created))
