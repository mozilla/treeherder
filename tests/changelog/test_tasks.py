import pytest
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning, module="github3")
from .test_collector import fake_env

from treeherder.changelog.tasks import update_changelog
from treeherder.changelog.models import Changelog


@pytest.mark.django_db()
def test_update_changelog():
    num_entries = Changelog.objects.count()

    with fake_env("GITHUB_CLIENT_SECRET", "GITHUB_CLIENT_ID"):
        update_changelog()

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert Changelog.objects.count() > num_entries
