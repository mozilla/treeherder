import binascii
import json
import os
import re
from datetime import UTC, datetime, timedelta
from unittest import mock

import responses

from treeherder.changelog.collector import collect


def random_id():
    return binascii.hexlify(os.urandom(16)).decode("utf8")


COMMITS = re.compile(r"https://api.github.com/repos/.*/.*/commits\?.*")
COMMIT_INFO = re.compile(r"https://api.github.com/repos/.*/.*/commits/.*")


def prepare_responses():
    now = datetime.now(tz=UTC).isoformat(timespec="seconds")

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
@mock.patch("treeherder.utils.github.pygithub_get_repo")
def test_collect(mock_pygithub_get_repo):
    now = datetime.now(tz=UTC)
    yesterday = now - timedelta(days=1)
    yesterday_str = yesterday.isoformat(timespec="seconds")

    # Mock the GitRelease object structure expected by collector.py
    mock_author = mock.Mock()
    mock_author.login = "mock_tarek_release"
    mock_release = mock.Mock()
    mock_release.name = "mock_release_name"
    mock_release.tag_name = "mock_release_tag"
    mock_release.published_at = now
    mock_release.id = "mock_release_id_123"
    mock_release.html_url = "mock_release_url"
    mock_release.author = mock_author

    mock_repo = mock.Mock()
    mock_repo.get_releases.return_value = [mock_release]
    mock_pygithub_get_repo.return_value = mock_repo

    prepare_responses()
    res = list(collect(yesterday_str))

    # Assertions to ensure both release and commit data are collected
    assert len(res) > 0

    # Verify a release entry created from the mock PyGithub object
    release_entry = next((item for item in res if item["type"] == "release"), None)
    assert release_entry is not None
    assert release_entry["author"] == "mock_tarek_release"
    assert release_entry["message"] == "Released mock_release_name"
    assert release_entry["remote_id"] == "mock_release_id_123"
    assert release_entry["url"] == "mock_release_url"
    assert release_entry["date"] == now.isoformat(timespec="seconds")

    # Verify a commit entry created from responses mock
    commit_entry = next((item for item in res if item["type"] == "commit"), None)
    assert commit_entry is not None
    assert commit_entry["author"] == "tarek"
    assert commit_entry["message"] == "yeah"
