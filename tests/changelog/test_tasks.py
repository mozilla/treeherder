from datetime import UTC, datetime
from unittest import mock

import pytest
import responses

from tests.changelog.test_collector import prepare_responses
from treeherder.changelog.models import Changelog
from treeherder.changelog.tasks import update_changelog


@pytest.mark.django_db()
@responses.activate
@mock.patch("treeherder.utils.github.pygithub_get_repo")
def test_update_changelog(mock_pygithub_get_repo):
    # Mock the GitRelease object structure expected by collector.py
    now = datetime.now(tz=UTC)
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
    mock_commit.files = [mock_file1, mock_file2]
    mock_commit.commit.comitter.date = now.isoformat()
    mock_parent = mock.Mock()
    mock_parent.sha = "mock_parent_sha"
    mock_commit.parents = [mock_parent]

    mock_repo = mock.Mock()
    mock_repo.get_releases.return_value = [mock_release]
    mock_repo.get_commit.return_value = [mock_commit]
    mock_pygithub_get_repo.return_value = mock_repo

    prepare_responses()
    num_entries = Changelog.objects.count()

    update_changelog()

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert Changelog.objects.count() > num_entries

    # Also verify that at least one release entry was created
    assert Changelog.objects.filter(type="release", remote_id="mock_release_id_123").exists()
