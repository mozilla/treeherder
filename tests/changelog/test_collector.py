from datetime import UTC, datetime, timedelta
from unittest import mock

from treeherder.changelog.collector import collect


def _mock_github_repo(now):
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

    mock_commit = mock.Mock()
    mock_commit.sha = "mock_commit_sha"
    mock_commit.html_url = "url"
    mock_commit.files = [mock_file1, mock_file2]
    mock_commit.commit.message = "yeah"
    mock_commit.commit.author.name = "tarek"
    mock_commit.commit.author.date = now
    mock_commit.commit.committer.date = now
    mock_parent = mock.Mock()
    mock_parent.sha = "mock_parent_sha"
    mock_commit.parents = [mock_parent]

    mock_repo = mock.Mock()
    mock_repo.get_releases.return_value = [mock_release]
    mock_repo.get_commits.return_value = [mock_commit]
    mock_repo.get_commit.return_value = mock_commit
    return mock_repo


@mock.patch("treeherder.utils.github.pygithub_get_repo")
def test_collect(mock_pygithub_get_repo):
    now = datetime.now(tz=UTC)
    yesterday = now - timedelta(days=1)
    yesterday_str = yesterday.isoformat(timespec="seconds")

    mock_pygithub_get_repo.return_value = _mock_github_repo(now)
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

    # Verify a commit entry created from the mock PyGithub object
    commit_entry = next((item for item in res if item["type"] == "commit"), None)
    assert commit_entry is not None
    assert commit_entry["author"] == "tarek"
    assert commit_entry["message"] == "yeah"
    assert commit_entry["date"] == now.isoformat(timespec="seconds")


@mock.patch("treeherder.utils.github.pygithub_get_repo")
def test_get_changes_filter_by_path_loads_files_via_get_commit(mock_pygithub_get_repo):
    """filter_by_path still uses get_commit() for file lists, not the list-commits payload."""
    now = datetime.now(tz=UTC)
    mock_repo = _mock_github_repo(now)
    mock_pygithub_get_repo.return_value = mock_repo

    from treeherder.changelog.collector import GitHub

    changes = list(
        GitHub().get_changes(
            user="o",
            repository="r",
            filters=[["filter_by_path", "file1"]],
            number=10,
            since=now.isoformat(timespec="seconds"),
        )
    )

    mock_repo.get_commit.assert_called_once_with("mock_commit_sha")
    commit_changes = [c for c in changes if c["type"] == "commit"]
    assert len(commit_changes) == 1
    assert commit_changes[0]["files"] == ["file1", "file2"]
    assert commit_changes[0]["date"] == now.isoformat(timespec="seconds")
