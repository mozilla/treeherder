from datetime import UTC, datetime
from unittest import mock

import pytest

from tests.changelog.test_collector import _mock_github_repo
from treeherder.changelog.models import Changelog
from treeherder.changelog.tasks import update_changelog


@pytest.mark.django_db()
@mock.patch("treeherder.utils.github.pygithub_get_repo")
def test_update_changelog(mock_pygithub_get_repo):
    now = datetime.now(tz=UTC)
    mock_pygithub_get_repo.return_value = _mock_github_repo(now)

    num_entries = Changelog.objects.count()

    update_changelog()

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert Changelog.objects.count() > num_entries

    # Also verify that at least one release entry was created
    assert Changelog.objects.filter(type="release", remote_id="mock_release_id_123").exists()
