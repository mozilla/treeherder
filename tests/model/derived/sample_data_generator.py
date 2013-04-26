"""
Functions for flexible generation of sample input job JSON.

"""
import json
import os
import time
from datetime import timedelta

from treeherder.model import utils


def ref_data_json():
    """Return reference data json structure"""

    filename = os.path.join(
        os.path.abspath(os.path.dirname(__file__)),
        "ref_data.json",
    )

    json_data = ""
    with open(filename) as f:
        json_data = f.read()

    return json_data


def job_json(**kwargs):
    return json.dumps(job_data(**kwargs))


def job_data(**kwargs):
    jobs_obj = {
        "sources": [
            {
                "commit_timestamp": 1365732271,
                "push_timestamp": 1365732271,
                "comments": "Bug 854583 - Use _pointer_ instead of...",
                "repository": "mozilla-aurora",
                "revision": "c91ee0e8a980"
            }
        ],
        "revision_hash": "24fd64b8251fac5cf60b54a915bffa7e51f636b5",
        "jobs": [{

            'build_platform': build_platform(**kwargs.pop("build_platform", {})),

            'submit_timestamp': kwargs.pop("submit_timestamp", submit_timestamp()),

            'start_timestamp': kwargs.pop("start_timestamp", start_timestamp()),

            'name': kwargs.pop("name", u'mochitest-5'),

            'option_collection': option_collection(
                **kwargs.pop("build_platform", {})),

            'log_references': log_references(kwargs.pop("log_references", [])),

            'who': kwargs.pop("who", u'sendchange-unittest'),

            'reason': kwargs.pop("reason", u'scheduler'),

            'artifact': kwargs.pop("artifact", {}),

            'machine_platform': machine_platform(
                **kwargs.pop("machine_platform", {})),

            'machine': kwargs.pop("machine", u'talos-r3-xp-088'),

            'state': kwargs.pop("state", 'TODO'),

            'result': kwargs.pop("result", 0),

            'job_guid': kwargs.pop(
                "job_guid", "f3e3a9e6526881c39a3b2b6ff98510f213b3d4ed"),

            'product_name': kwargs.pop("product_name", u'firefox'),

            'end_timestamp': kwargs.pop("end_timestamp", end_timestamp()),
        }]
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
        'debug': True
    }

    defaults.update(kwargs)

    return defaults


def log_references(log_refs=None):
    if not log_refs:
        log_refs = [
            {
                "url": "http://ftp.mozilla.org/pub/...",
                "name": "unittest"
            }
        ]
    return log_refs


def build_platform(**kwargs):
    """
    Return a sample data structure, with default values.

    """
    defaults = {
        'platform': 'WINNT5.1',
        'os_name': 'win',
        'architecture': 'x86',
        'vm': False
    }

    defaults.update(kwargs)

    return defaults


def machine_platform(**kwargs):
    """
    Return a sample data structure, with default values.

    """
    defaults = {
        'platform': 'WINNT5.1',
        'os_name': 'win',
        'architecture': 'x86',
        'vm': False
    }

    defaults.update(kwargs)

    return defaults


def create_date_based_data(jm, monkeypatch, dates=None):
    """Store and process some good and some error blobs on specified dates"""

    if not dates:
        dates = [
            get_timestamp_days_ago(5),
            get_timestamp_days_ago(4),
            get_timestamp_days_ago(3),
        ]

    # 5 days ago
    mocknow = dates[0]

    def mock_now():
        return mocknow
    monkeypatch.setattr(utils, 'get_now_timestamp', mock_now)

    # store the error blob
    blob = job_json(
        testrun={"date": dates[0]},
        test_build={"name": "one"},
    )
    badblob = "{0}fooo".format(blob)
    jm.store_test_data(badblob, error="badness")

    # 4 days ago
    mocknow = dates[1]
    # store the good blobs
    blobs = [
        job_json(
            testrun={"date": dates[1]},
            name="one",
        ),
        job_json(
            testrun={"date": dates[1]},
            name="three",
        ),
    ]

    # 3 days ago
    mocknow = dates[2]

    # store another error blob
    blob = job_json(
        testrun={"date": dates[2]},
        name="four",
    )
    badblob = "{0}fooo".format(blob)
    jm.store_test_data(badblob, error="Malformed JSON")

    for blob in blobs:
        jm.store_test_data(blob)

    # now process all of them
    jm.process_objects(4)
