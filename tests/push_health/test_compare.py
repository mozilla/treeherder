import pytest
import datetime
import responses

from mozci.push import Push as MozciPush

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
    responses.add(
        responses.GET,
        f'https://hg.mozilla.org/{test_push.repository.name}/json-pushes?version=2&startID=536015&endID=536016',
        json={
            "pushes": {
                "536016": {
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
    responses.add(
        responses.GET,
        f'https://hg.mozilla.org/{test_push.repository.name}/json-automationrelevance/abcdef77949168d16c03a4cba167678b7ab65f76?backouts=1',
        json={
            "changesets": [
                {
                    "author": "Steve Fink \u003csfink@mozilla.com\u003e",
                    "backsoutnodes": [],
                    "bugs": [
                        {
                            "no": "1348796",
                            "url": "https://bugzilla.mozilla.org/show_bug.cgi?id=1348796",
                        }
                    ],
                    "date": [1490029492.0, 25200],
                    "desc": "Bug 1348796 - Make debug overridable in autospider.py, r=arai",
                    "extra": {
                        "branch": "default",
                        "rebase_source": "0f47dbc143abe2ce239e2de10eb9bc83ae2d8a94",
                    },
                    "files": [
                        "js/src/devtools/automation/autospider.py",
                        "js/src/devtools/automation/variants/warnaserrdebug",
                    ],
                    "node": "a7bff3534d20c926aae43af3a056ba0a29c8c02b",
                    "parents": ["0c3915509f06dfed6756c23ed7f7b040c30f0789"],
                    "phase": "public",
                    "pushdate": [1490176437, 0],
                    "pushhead": "4c861bc93933e51a6abe88eb9c4c26dd4868230d",
                    "pushid": 536017,
                    "pushuser": "aselagea@mozilla.com",
                    "rev": 1072292,
                    "reviewers": [{"name": "arai", "revset": "reviewer(arai)"}],
                    "treeherderrepo": "try",
                    "treeherderrepourl": "https://treeherder.mozilla.org/#/jobs?repo=try",
                },
            ],
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

    mozciPush = MozciPush([parent_revision], test_repository.name)
    history = get_commit_history(mozciPush, test_push)

    assert history['parentSha'] == parent_revision
    assert history['parentRepository']['name'] == test_repository.name
