import newrelic.agent
import datetime
from django.db import transaction

from treeherder.changelog.models import Changelog, ChangelogFile
from treeherder.changelog.collector import collect


def update_changelog(days=1):
    """
    Collect changes and update the DB.
    """
    # collecting last day of changes across all sources
    since = datetime.datetime.now() - datetime.timedelta(days=days)
    since = since.strftime("%Y-%m-%dT%H:%M:%S")

    with transaction.atomic():
        for entry in collect(since):
            files = entry.pop("files", [])
            # lame hack to remove TZ awareness
            if entry["date"].endswith("Z"):
                entry["date"] = entry["date"][:-1]
            changelog = Changelog.objects.create(**entry)
            [ChangelogFile.objects.create(name=name, changelog=changelog)
             for name in files]
