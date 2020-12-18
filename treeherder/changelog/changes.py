from datetime import timedelta

from django.db.models import Q, QuerySet
from django.utils import timezone

from treeherder.changelog.models import Changelog


def get_changes(start_date: str = None, end_date: str = None) -> QuerySet:
    """Grabbing the latest changes done in the past days."""
    since_recently = timezone.now() - timedelta(days=15)
    start_date = start_date or since_recently

    filters = Q(date__gte=start_date)
    if end_date:
        filters = filters & Q(date__lte=end_date)

    return Changelog.objects.filter(filters).order_by("date")
