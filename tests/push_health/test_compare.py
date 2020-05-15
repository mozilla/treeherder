import pytest
import datetime
import responses

from treeherder.model.models import Push, Repository
from treeherder.push_health.compare import get_commit_history

test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'


@pytest.fixture
def mock_rev(test_push):
    responses.add(
        responses.GET,
        f'https://hg.mozilla.org/{test_push.repository.name}/rev/{test_revision}?style=json',
        json={
            "node": test_revision,
            "date": [1589318819.0, -7200],
            "desc": "Try Chooser Enhanced (305 tasks selected)\n\nPushed via `mach try again`",
            "backedoutby": "",
            "branch": 'autoland',
            "bookmarks": [],
            "tags": [],
            "user": "Tomislav Jovanovic \u003ctomica@gmail.com\u003e",
            "parents": [parent_revision],
            "phase": "draft",
            "pushid": 536019,
            "pushdate": [1589318855, 0],
            "pushuser": "tomica@gmail.com",
            "landingsystem": None,
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
            "lastpushid": 536138,
            "pushes": {
                "536018": {
                    "changesets": [
                        "abcdef77949168d16c03a4cba167678b7ab65f76",
                        "084c7f0fcde34f813013a96423e6bec18837ead4",
                        "81ab76256e9a2198a2c9f368d260c2f46ef749a0",
                    ],
                    "date": 1589318625,
                    "user": "tziade@mozilla.com",
                }
            },
        },
        content_type='application/json',
        status=200,
    )


@responses.activate
def test_get_commit_history(test_push, test_repository, mock_rev, mock_json_pushes):
    autoland = Repository.objects.create(
        repository_group=test_repository.repository_group,
        name='autoland',
        dvcs_type=test_repository.dvcs_type,
        url='autoland',
        codebase=test_repository.codebase,
    )
    Push.objects.create(
        revision=parent_revision,
        repository=autoland,
        author='foo@bar.baz',
        time=datetime.datetime.now(),
    )

    history = get_commit_history(test_push.repository, test_revision, test_push)
    assert history['parentSha'] == parent_revision
    assert history['parentPushRevision'] == parent_revision
    assert history['parentRepository']['name'] == autoland.name
