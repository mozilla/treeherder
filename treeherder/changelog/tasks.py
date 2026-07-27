import datetime
import logging

from django.db import transaction

from treeherder.changelog.collector import collect
from treeherder.changelog.models import Changelog, ChangelogFile

logger = logging.getLogger(__name__)


def update_changelog(days=1):
    """
    Collect changes and update the DB.
    """
    logger.info(f"Updating unified changelog (days={days})")
    # collecting last day of changes across all sources
    since = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(days=days)
    since = since.isoformat(timespec="seconds")

    created = 0
    existed = 0

    with transaction.atomic():
        for entry in collect(since):
            files = entry.pop("files", [])
            changelog, line_created = Changelog.objects.update_or_create(**entry)
            if not line_created:
                existed += 1
                continue
            created += 1
            [ChangelogFile.objects.create(name=name, changelog=changelog) for name in files]

    logger.info(f"Found {created + existed} items, {existed} existed and {created} where created.")
