from datetime import timedelta

from django.utils import timezone

from treeherder.changelog.models import Changelog


def get_changes(days=15):
    """Grabbing the latest changes done in the past days.
    """
    min_date = timezone.now() - timedelta(days=days)
    return Changelog.objects.filter(date__gte=min_date).order_by("date")
