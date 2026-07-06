from unittest.mock import patch

import pytest

from tests.changelog.test_collector import prepare_responses
from treeherder.changelog.models import Changelog
from treeherder.changelog.tasks import update_changelog


@pytest.mark.django_db()
def test_update_changelog():
    mock_repo = prepare_responses()
    num_entries = Changelog.objects.count()

    with patch("treeherder.utils.github.github_client") as mock_gh:
        mock_gh.get_repo.return_value = mock_repo
        update_changelog()

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert Changelog.objects.count() > num_entries
