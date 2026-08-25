import binascii
import os
from datetime import UTC, datetime, timedelta
from unittest import mock

from treeherder.changelog.collector import collect


def random_id():
    return binascii.hexlify(os.urandom(16)).decode("utf8")


def _mock_repo(now):
    mock_author = mock.Mock()
    mock_author.login = "mock_tarek_release"
    mock_release = mock.Mock()
    mock_release.name = "mock_release_name"
    mock_release.tag_name = "mock_release_tag"
    mock_release.published_at = now
    mock_release.id = "mock_release_id_123"
    mock_release.html_url = "mock_release_url"
    mock_release.author = mock_author

    mock_file1 = mock.Mock()
    mock_file1.filename = "file1"
    mock_file2 = mock.Mock()
    mock_file2.filename = "file2"

    mock_commit_detail = mock.Mock()
    mock_commit_detail.files = [mock_file1, mock_file2]
    mock_commit_detail.commit.committer.date = now.isoformat()
    mock_parent = mock.Mock()
    mock_parent.sha = "mock_parent_sha"
    mock_commit_detail.parents = [mock_parent]

    mock_git_author = mock.Mock()
    mock_git_author.name = "tarek"
    mock_git_author.date = now.isoformat()
    mock_git_commit_inner = mock.Mock()
    mock_git_commit_inner.message = "yeah"
    mock_git_commit_inner.author = mock_git_author
    mock_git_commit_inner.committer = mock.Mock()
    mock_git_commit_inner.committer.date = now.isoformat()

    mock_git_commit = mock.Mock()
    mock_git_commit.sha = random_id()
    mock_git_commit.html_url = "url"
    mock_git_commit.commit = mock_git_commit_inner

    mock_repo = mock.Mock()
    mock_repo.get_releases.return_value = [mock_release]
    mock_repo.get_commits.return_value = [mock_git_commit]
    mock_repo.get_commit.return_value = mock_commit_detail
    return mock_repo


@mock.patch("treeherder.utils.github.get_repo")
def test_collect(mock_get_repo):
    now = datetime.now(tz=UTC)
    yesterday = now - timedelta(days=1)
    yesterday_str = yesterday.isoformat(timespec="seconds")

    mock_repo = _mock_repo(now)
    mock_get_repo.return_value = mock_repo

    res = list(collect(yesterday_str))

    assert len(res) > 0
    mock_repo.get_commits.assert_called()
    since_arg = mock_repo.get_commits.call_args.kwargs.get("since")
    assert since_arg == datetime.fromisoformat(yesterday_str)

    release_entry = next((item for item in res if item["type"] == "release"), None)
    assert release_entry is not None
    assert release_entry["author"] == "mock_tarek_release"
    assert release_entry["message"] == "Released mock_release_name"
    assert release_entry["remote_id"] == "mock_release_id_123"
    assert release_entry["url"] == "mock_release_url"
    assert release_entry["date"] == now.isoformat(timespec="seconds")

    commit_entry = next((item for item in res if item["type"] == "commit"), None)
    assert commit_entry is not None
    assert commit_entry["author"] == "tarek"
    assert commit_entry["message"] == "yeah"
