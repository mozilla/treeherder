import binascii
import json
import os
import re
from datetime import (datetime,
                      timedelta)

import responses

from treeherder.changelog.collector import collect  # noqa isort:skip


def random_id():
    return binascii.hexlify(os.urandom(16)).decode("utf8")


RELEASES = re.compile(r"https://api.github.com/repos/.*/.*/releases.*")
COMMITS = re.compile(r"https://api.github.com/repos/.*/.*/commits\?.*")
COMMIT_INFO = re.compile(r"https://api.github.com/repos/.*/.*/commits/.*")


def prepare_responses():
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    def releases(request):

        data = [
            {
                "name": "ok",
                "published_at": now,
                "id": random_id(),
                "html_url": "url",
                "tag_name": "some tag",
                "author": {"login": "tarek"},
            }
        ]
        return 200, {}, json.dumps(data)

    responses.add_callback(
        responses.GET, RELEASES, callback=releases, content_type="application/json"
    )

    def _commit():
        files = [{"filename": "file1"}, {"filename": "file2"}]
        return {
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

    def commit(request):
        return 200, {}, json.dumps(_commit())

    def commits(request):
        return 200, {}, json.dumps([_commit()])

    responses.add_callback(
        responses.GET, COMMITS, callback=commits, content_type="application/json"
    )
    responses.add_callback(
        responses.GET, COMMIT_INFO, callback=commit, content_type="application/json"
    )


@responses.activate
def test_collect():
    yesterday = datetime.now() - timedelta(days=1)
    yesterday = yesterday.strftime("%Y-%m-%dT%H:%M:%S")
    prepare_responses()
    res = list(collect(yesterday))

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert len(res) > 0
