import time
from datetime import datetime, timedelta

import django_filters
from django.db.models import Aggregate, CharField

# queries are faster when filtering a range by id rather than name
# trunk: mozilla-central, mozilla-inbound, autoland
# firefox-releases: mozilla-beta, mozilla-release
# comm-releases: comm-beta
REPO_GROUPS = {
    'trunk': [1, 2, 77],
    'firefox-releases': [6, 7],
    'comm-releases': [38],
}


class GroupConcat(Aggregate):
    function = 'GROUP_CONCAT'
    template = '%(function)s(%(distinct)s%(expressions)s)'
    allow_distinct = True

    def __init__(self, expression, distinct=False, **extra):
        super().__init__(
            expression, distinct='DISTINCT ' if distinct else '', output_field=CharField(), **extra
        )


class NumberInFilter(django_filters.filters.BaseInFilter, django_filters.NumberFilter):
    pass


class CharInFilter(django_filters.filters.BaseInFilter, django_filters.CharFilter):
    pass


def to_datetime(datestr):
    """get a timestamp from a datestr like 2014-03-31"""
    return datetime.strptime(datestr, "%Y-%m-%d")


def to_timestamp(datetime_obj):
    """get a unix timestamp from a datetime object"""
    if datetime_obj:
        return int(time.mktime(datetime_obj.timetuple()))
    return None


def get_end_of_day(date):
    """Add a 23:59:59.999 timestamp (default is 00:00:00)"""
    return date + timedelta(days=1, microseconds=-1)
