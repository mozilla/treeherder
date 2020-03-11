import pytest
import responses

from tests.changelog.test_collector import prepare_responses
from treeherder.changelog.models import Changelog
from treeherder.changelog.tasks import update_changelog


@pytest.mark.django_db()
@responses.activate
def test_update_changelog():
    prepare_responses()
    num_entries = Changelog.objects.count()

    update_changelog()

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert Changelog.objects.count() > num_entries
