import datetime
import time

import django_filters


class NumberInFilter(django_filters.filters.BaseInFilter,
                     django_filters.NumberFilter):
    pass


class CharInFilter(django_filters.filters.BaseInFilter,
                   django_filters.CharFilter):
    pass


def to_datetime(datestr):
    """get a timestamp from a datestr like 2014-03-31"""
    return datetime.datetime.strptime(
        datestr,
        "%Y-%m-%d")


def to_timestamp(datetime_obj):
    """get a unix timestamp from a datetime object"""
    if datetime_obj:
        return int(time.mktime(datetime_obj.timetuple()))
    return None


def as_dict(queryset, key):
    return {getattr(item, key): item for item in queryset}
