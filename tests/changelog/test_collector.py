import binascii
import json
import os
import re
import warnings
from contextlib import contextmanager
from datetime import (datetime,
                      timedelta)

import responses

from treeherder.changelog.collector import collect  # noqa isort:skip


def random_id():
    return binascii.hexlify(os.urandom(16)).decode("utf8")


RELEASES = re.compile(r"https://api.github.com/repos/.*/.*/releases.*")
COMMITS = re.compile(r"https://api.github.com/repos/.*/.*/commits\?.*")
COMMIT_INFO = re.compile(r"https://api.github.com/repos/.*/.*/commits/.*")


@responses.activate
def test_collect():
    yesterday = datetime.now() - timedelta(days=1)
    yesterday = yesterday.strftime("%Y-%m-%dT%H:%M:%S")

    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    releases = [
        {
            "name": "ok",
            "published_at": now,
            "id": random_id(),
            "html_url": "url",
            "tag_name": "some tag",
            "author": {"login": "tarek"},
        }
    ]

    responses.add(responses.GET, RELEASES, json=releases, status=200)

    files = [{"filename": "file1"}, {"filename": "file2"}]
    commit = {
        "files": files,
        "name": "ok",
        "sha": random_id(),
        "html_url": "url",
        "tag_name": "some tag",
        "commit": {
            "message": "yeah",
            "author": {"name": "tarek", "date": now},
            "files": files,
        },
    }

    commits = [commit]
    responses.add(responses.GET, COMMITS, json=commits, status=200)

    responses.add(responses.GET, COMMIT_INFO, json=commit, status=200)

    res = list(collect(yesterday))

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert len(res) > 0
