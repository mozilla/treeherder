import time
import json
import datetime
import sys


def get_now_timestamp():
    """
    Return a unix timestamp for the current time.

    This is useful because it can be mocked out in unit tests.
    """
    return int(time.time())


def where_wolf(project, flat_exclusions):
    """
    Return the AND portion of a WHERE clause based on all the combinations of
    ``flat_exclusions``

    project - The repo/branch/project name to be used.  Ignore all others.
    flat_exclusions - looks like::

        {

            "mozilla-inbound": {
                "osx-10-9": {
                    "Talos chrome": {
                        "debug": 1,
                        "opt": 1,
                        "asan": 1,
                        "pgo": 1
                    },
                    "Talos": {
                        "debug": 1,
                        "opt": 1,
                        "asan": 1,
                        "pgo": 1
                    },
                    "Talos xperf": { ... },
                }
            }
        }

    """

    values_list = []

    for exclusion in flat_exclusions:
        repos = json.loads(exclusion["flat_exclusion"])
        platforms = repos[project]
        for platform, jobs in platforms.items():
            for job, opts in jobs.items():
                for opt, v in opts.items():
                    values_list.extend([platform, job, opt])

    condition = " (mp.platform = %s AND jt.name = %s AND opt.name = %s)"
    condition_list = " OR ".join([condition] * (len(values_list)/3))
    return " AND ({0})".format(condition_list), values_list
