import time
from datetime import (datetime,
                      timedelta)

import django_filters
from django.conf import settings

from treeherder.model.models import Repository


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


def as_dict(queryset, key):
    return {getattr(item, key): item for item in queryset}


def get_end_of_day(date):
    """Turn a date string into a datetime in order to
       add a 23:59:59.999 timestamp (default is 00:00:00)"""
    new_date = datetime.strptime(date, '%Y-%m-%d') + timedelta(days=1, microseconds=-1)
    return new_date.strftime('%Y-%m-%d %H:%M:%S.%f')


def get_repository(param):
    """Returns repository id's by name"""
    queryset = Repository.objects.values_list('id', flat=True)

    if param == 'all':
        return queryset.filter(active_status='active')

    if param in settings.REPO_GROUPS:
        param = settings.REPO_GROUPS[param]
    else:
        param = [param]

    return queryset.filter(name__in=param)
