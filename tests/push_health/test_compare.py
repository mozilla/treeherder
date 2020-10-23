import pytest
import datetime
import responses

from treeherder.model.models import Push
from treeherder.push_health.compare import get_commit_history

test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'


@pytest.fixture
def mock_rev(test_push):
    # This is the revision/push under test
    responses.add(
        responses.GET,
        f'https://hg.mozilla.org/{test_push.repository.name}/rev/{test_revision}?style=json',
        json={
            "node": test_revision,
            "date": [1589318819.0, -7200],
            "branch": test_push.repository.name,
            "user": "Hiro Protagonist \u003chiro@protagonist.com\u003e",
            "parents": [parent_revision],
            "phase": "draft",
            "pushid": 536019,
            "pushdate": [1589318855, 0],
            "pushuser": "hiro@protagonist.com",
        },
        content_type='application/json',
        status=200,
    )


@pytest.fixture
def mock_json_pushes(test_push):
    responses.add(
        responses.GET,
        f'https://hg.mozilla.org/{test_push.repository.name}/json-pushes?version=2&startID=536017&endID=536018',
        json={
            "pushes": {
                "536018": {
                    "changesets": [
                        "abcdef77949168d16c03a4cba167678b7ab65f76",
                        "084c7f0fcde34f813013a96423e6bec18837ead4",
                        "81ab76256e9a2198a2c9f368d260c2f46ef749a0",
                    ],
                    "date": 1589318625,
                    "user": "user@example.org",
                }
            },
        },
        content_type='application/json',
        status=200,
    )


@responses.activate
def test_get_commit_history(test_push, test_repository, mock_rev, mock_json_pushes):
    Push.objects.create(
        revision=parent_revision,
        repository=test_repository,
        author='foo@bar.baz',
        time=datetime.datetime.now(),
    )

    history = get_commit_history(test_repository, test_revision, test_push)
    print('\n<><><>history')
    print(history)
    assert history['parentSha'] == parent_revision
    assert history['parentRepository']['name'] == test_repository.name
