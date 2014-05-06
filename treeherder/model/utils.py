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

    condition_list = []

    for exclusion in flat_exclusions:
        repos = json.loads(exclusion["flat_exclusion"])
        for repo, platforms in repos.items():
            if repo == project:
                for platform, jobs in platforms.items():
                    for job, opts in jobs.items():
                        for opt, v in opts.items():
                            condition_list.append(
                                (" (mp.platform = '{0}' AND "
                                "jt.name = '{1}' AND "
                                "opt.name = '{2}')").format(platform, job, opt)
                            )

    if condition_list:
        return "AND ({0})".format(" OR ".join(condition_list))
    else:
        return None
