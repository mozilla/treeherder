import time
from datetime import (datetime,
                      timedelta)

import django_filters

from treeherder.model.models import Repository

REPO_GROUPS = {
    'trunk': ['mozilla-central', 'mozilla-inbound', 'autoland'],
    'firefox-releases': ['mozilla-beta', 'mozilla-release'],
    'comm-releases': ['comm-beta', 'comm-release'],
}


class NumberInFilter(django_filters.filters.BaseInFilter,
                     django_filters.NumberFilter):
    pass


class CharInFilter(django_filters.filters.BaseInFilter,
                   django_filters.CharFilter):
    pass


def to_datetime(datestr):
    """get a timestamp from a datestr like 2014-03-31"""
    return datetime.strptime(
        datestr,
        "%Y-%m-%d")


def to_timestamp(datetime_obj):
    """get a unix timestamp from a datetime object"""
    if datetime_obj:
        return int(time.mktime(datetime_obj.timetuple()))
    return None


def get_end_of_day(date):
    """Add a 23:59:59.999 timestamp (default is 00:00:00)"""
    return date + timedelta(days=1, microseconds=-1)


def get_repository(name):
    """Returns repository id's by name"""
    queryset = Repository.objects.values_list('id', flat=True)

    if name == 'all':
        return queryset.filter(active_status='active')

    if name in REPO_GROUPS:
        param = REPO_GROUPS[name]
    else:
        param = [name]

    return queryset.filter(name__in=param)
