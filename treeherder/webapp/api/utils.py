import time
from datetime import datetime, timedelta

import django_filters
import taskcluster_urls
from django.core.cache import cache
from django.db.models import Aggregate, CharField

from treeherder.utils.http import fetch_json

# queries are faster when filtering a range by id rather than name
# trunk: mozilla-central, autoland
# firefox-releases: mozilla-beta, mozilla-release
# comm-releases: comm-beta, comm-release
REPO_GROUPS = {
    "trunk": [1, 2, 77],
    "firefox-releases": [6, 7],
    "comm-releases": [38, 135],
}

FIVE_DAYS = 432000

# Constant used to check for sheriffed frameworks
SHERIFFED_FRAMEWORKS = [
    "awsy",
    "browsertime",
    "build_metrics",
    "devtools",
    "js-bench",
    "mozperftest",
    "talos",
]


class GroupConcat(Aggregate):
    function = "GROUP_CONCAT"
    template = "%(function)s(%(distinct)s%(expressions)s)"
    allow_distinct = True

    def __init__(self, expression, distinct=False, **extra):
        super().__init__(
            expression, distinct="DISTINCT " if distinct else "", output_field=CharField(), **extra
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


def get_artifact_list(root_url, task_id):
    artifacts_url = taskcluster_urls.api(root_url, "queue", "v1", f"task/{task_id}/artifacts")
    artifacts = {"artifacts": []}
    try:
        artifacts = fetch_json(artifacts_url)
    except Exception as e:
        print(e)
    finally:
        return artifacts.get("artifacts", [])


def get_profile_artifact_url(alert, metadata_key):
    tc_root_url = cache.get("tc_root_url", "")
    # Get the taskcluster metadata we'll use. It's determined by the caller.
    task_metadata = alert[metadata_key]

    # Return None if task_id wasn't found
    if not task_metadata.get("task_id") or not tc_root_url:
        return None

    # If the url was already cached, don't calculate again, just return it
    if cache.get(task_metadata.get("task_id")):
        return cache.get(task_metadata.get("task_id"))

    artifacts_json = get_artifact_list(tc_root_url, task_metadata.get("task_id"))
    profile_artifact = [
        artifact
        for artifact in artifacts_json
        if artifacts_json
        and artifact.get("name", "").startswith("public/test_info/profile_")
        and artifact.get("name", "").endswith(".zip")
    ]

    if not profile_artifact:
        return None

    task_url = f"{tc_root_url}/api/queue/v1/task/{task_metadata['task_id']}"
    # There's only one profile relevant for performance per task
    artifact_url = (
        f"{task_url}/runs/{str(task_metadata['retry_id'])}/artifacts/{profile_artifact[0]['name']}"
    )
    cache.set(task_metadata.get("task_id"), artifact_url, FIVE_DAYS)

    return artifact_url
