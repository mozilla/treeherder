import binascii
import os
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from treeherder.changelog.collector import collect


def random_id():
    return binascii.hexlify(os.urandom(16)).decode("utf8")


def prepare_responses():
    now = datetime.now()

    mock_release = MagicMock()
    mock_release.published_at = now
    mock_release.author.login = "tarek"
    mock_release.name = "ok"
    mock_release.tag_name = "some tag"
    mock_release.id = random_id()
    mock_release.html_url = "url"

    mock_commit = MagicMock()
    mock_commit.sha = random_id()
    mock_commit.html_url = "url"
    mock_commit.commit.message = "yeah"
    mock_commit.commit.author.name = "tarek"
    mock_commit.commit.author.date = now

    mock_detailed_commit = MagicMock()
    mock_file = MagicMock()
    mock_file.filename = "file1"
    mock_detailed_commit.files = [mock_file]

    mock_repo = MagicMock()
    mock_repo.get_releases.return_value = [mock_release]
    mock_repo.get_commits.return_value = [mock_commit]
    mock_repo.get_commit.return_value = mock_detailed_commit

    return mock_repo


def test_collect():
    yesterday = datetime.now() - timedelta(days=1)
    mock_repo = prepare_responses()

    with patch("treeherder.utils.github.github_client") as mock_gh:
        mock_gh.get_repo.return_value = mock_repo
        res = list(collect(yesterday))

        assert len(res) > 0
        # Verify it includes the release and the commit
        types = [r["type"] for r in res]
        assert "release" in types
        assert "commit" in types
