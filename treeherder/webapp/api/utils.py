import requests
import json
import taskcluster_urls as liburls

import time
from datetime import datetime, timedelta

import django_filters
from django.db.models import Aggregate, CharField

# queries are faster when filtering a range by id rather than name
# trunk: mozilla-central, autoland
# firefox-releases: mozilla-beta, mozilla-release
# comm-releases: comm-beta, comm-release
REPO_GROUPS = {
    'trunk': [1, 2, 77],
    'firefox-releases': [6, 7],
    'comm-releases': [38, 135],
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


def get_profile_artifact_url(alert, task_metadata):
    tc_root_url = alert.summary.repository.tc_root_url
    index_url = liburls.api(
        tc_root_url,
        'queue',
        'v1',
        f"task/{task_metadata['task_id']}/runs/{task_metadata['retry_id']}/artifacts"
    )
    response = requests.get(index_url)
    artifacts = json.loads(response.content)
    profile_artifact = [
        artifact for artifact in artifacts["artifacts"]
        if artifact["name"].startswith("public/test_info/profile_")
           and artifact["name"].endswith(".zip")
    ]
    return f"{index_url}/{profile_artifact[0]['name']}"
