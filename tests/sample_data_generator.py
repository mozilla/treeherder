"""
Functions for flexible generation of sample input job JSON.

"""
from __future__ import division

import time
from datetime import timedelta


def job_data(**kwargs):
    jobs_obj = {
        "revision": kwargs.get("revision",
                               "24fd64b8251fac5cf60b54a915bffa7e51f636b5"),
        "job": {

            u"build_platform": build_platform(**kwargs.pop("build_platform", {})),

            u"submit_timestamp": kwargs.pop("submit_timestamp", submit_timestamp()),

            u"start_timestamp": kwargs.pop("start_timestamp", start_timestamp()),

            u"name": kwargs.pop("name", u"mochitest-5"),

            u"option_collection": option_collection(
                **kwargs.pop("option_collection", {})),

            u"log_references": log_references(kwargs.pop("log_references", [])),

            u"who": kwargs.pop("who", u"sendchange-unittest"),

            u"reason": kwargs.pop("reason", u"scheduler"),

            u"artifact": kwargs.pop("artifact", {}),

            u"machine_platform": machine_platform(
                **kwargs.pop("machine_platform", {})),

            u"machine": kwargs.pop("machine", u"talos-r3-xp-088"),

            u"state": kwargs.pop("state", u"completed"),

            u"result": kwargs.pop("result", 0),

            u"job_guid": kwargs.pop(
                u"job_guid", u"f3e3a9e6526881c39a3b2b6ff98510f213b3d4ed"),

            u"product_name": kwargs.pop("product_name", u"firefox"),

            u"end_timestamp": kwargs.pop("end_timestamp", end_timestamp()),
        }
    }

    # defaults.update(kwargs)

    return jobs_obj


def to_seconds(td):
    return (td.microseconds +
            (td.seconds + td.days * 24 * 3600) * 10 ** 6
            ) / 10 ** 6


def get_timestamp_days_ago(days_ago):
    now = int(time.time())
    return now - to_seconds(timedelta(int(days_ago)))


def submit_timestamp():
    """3 days ago"""
    return get_timestamp_days_ago(3)


def start_timestamp():
    """2 days ago"""
    return get_timestamp_days_ago(2)


def end_timestamp():
    """1 day ago"""
    return get_timestamp_days_ago(1)


def option_collection(**kwargs):
    """
    Return a sample data structure, with default values.

    """
    defaults = {
        u"debug": True
    }

    defaults.update(kwargs)

    return defaults


def log_references(log_refs=None):
    if not log_refs:
        log_refs = [
            {
                u"url": u"http://ftp.mozilla.org/pub/...",
                u"name": u"unittest"
            }
        ]
    return log_refs


def build_platform(**kwargs):
    """
    Return a sample data structure, with default values.

    """
    defaults = {
        u"platform": u"WINNT5.1",
        u"os_name": u"win",
        u"architecture": u"x86",
    }

    defaults.update(kwargs)

    return defaults


def machine_platform(**kwargs):
    """
    Return a sample data structure, with default values.

    """
    defaults = {
        u"platform": u"WINNT5.1",
        u"os_name": u"win",
        u"architecture": u"x86",
    }

    defaults.update(kwargs)

    return defaults
