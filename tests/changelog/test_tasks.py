from datetime import UTC, datetime
from unittest import mock

import pytest

from tests.changelog.test_collector import _mock_repo
from treeherder.changelog.models import Changelog
from treeherder.changelog.tasks import update_changelog


@pytest.mark.django_db()
@mock.patch("treeherder.utils.github.get_repo")
def test_update_changelog(mock_get_repo):
    now = datetime.now(tz=UTC)
    mock_get_repo.return_value = _mock_repo(now)

    num_entries = Changelog.objects.count()

    update_changelog()

    assert Changelog.objects.count() > num_entries
    assert Changelog.objects.filter(type="release", remote_id="mock_release_id_123").exists()
