import datetime

import responses

from treeherder.model.models import Push
from treeherder.push_health.compare import get_commit_history, get_response_object


def test_get_response_object(test_push, test_repository):
    resp = get_response_object('1234', [1, 2], 2, test_push, test_repository)
    assert resp['parentSha'] == '1234'
    assert resp['id'] == 1
    assert resp['exactMatch'] is False
    assert resp['parentPushRevision'] == '4c45a777949168d16c03a4cba167678b7ab65f76'


@responses.activate
def test_get_commit_history_automationrelevance(test_push, test_repository):
    test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
    parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'
    Push.objects.create(
        revision=parent_revision,
        repository=test_repository,
        author='foo@bar.baz',
        time=datetime.datetime.now(),
    )

    autorel_commits = {
        'changesets': [
            {
                'author': 'Cheech Marin <cheech.marin@gmail.com>',
                'backsoutnodes': [],
                'desc': 'Bug 1612891 - Suppress parsing easing error in early returns of ConvertKeyframeSequence.\n\nWe add a stack based class and supress the exception of parsing easing\nin the destructor, to avoid hitting the potential assertions.\n\nDifferential Revision: https://phabricator.services.mozilla.com/D64268\nDifferential Diff: PHID-DIFF-c4e7dcfpalwiem7bxsnk',
                'node': '3ca259f9cbdea763e64f10e286e58b271d89ab9d',
                'parents': [parent_revision],
            },
            {
                'author': 'libmozevent <release-mgmt-analysis@mozilla.com>',
                'desc': 'try_task_config for https://phabricator.services.mozilla.com/D64268\nDifferential Diff: PHID-DIFF-c4e7dcfpalwiem7bxsnk',
                'node': '18f68eb12ebbd88fe3a4fc3afe7df6529a0153fb',
                'parents': ['3ca259f9cbdea763e64f10e286e58b271d89ab9d'],
            },
        ],
        'visible': True,
    }

    autorel_url = 'https://hg.mozilla.org/{}/json-automationrelevance/{}'.format(
        test_repository.name, test_revision
    )
    responses.add(
        responses.GET,
        autorel_url,
        json=autorel_commits,
        content_type='application/json',
        status=200,
    )

    history = get_commit_history(test_repository, test_revision, test_push)
    assert history['parentSha'] == parent_revision
    assert history['parentPushRevision'] == parent_revision
    assert history['parentRepository']['name'] == test_repository.name


@responses.activate
def test_get_commit_history_parent_different_repo(test_push, test_repository, test_repository_2):
    test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
    parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'
    Push.objects.create(
        revision=parent_revision,
        repository=test_repository_2,
        author='foo@bar.baz',
        time=datetime.datetime.now(),
    )

    autorel_commits = {
        'changesets': [
            {
                'author': 'Cheech Marin <cheech.marin@gmail.com>',
                'backsoutnodes': [],
                'desc': 'Bug 1612891 - Suppress parsing easing error in early returns of ConvertKeyframeSequence.\n\nWe add a stack based class and supress the exception of parsing easing\nin the destructor, to avoid hitting the potential assertions.\n\nDifferential Revision: https://phabricator.services.mozilla.com/D64268\nDifferential Diff: PHID-DIFF-c4e7dcfpalwiem7bxsnk',
                'node': '3ca259f9cbdea763e64f10e286e58b271d89ab9d',
                'parents': [parent_revision],
            },
        ],
        'visible': True,
    }

    autorel_url = 'https://hg.mozilla.org/{}/json-automationrelevance/{}'.format(
        test_repository.name, test_revision
    )
    responses.add(
        responses.GET,
        autorel_url,
        json=autorel_commits,
        content_type='application/json',
        status=200,
    )

    history = get_commit_history(test_repository, test_revision, test_push)
    assert history['parentSha'] == parent_revision
    assert history['parentPushRevision'] == parent_revision
    assert history['parentRepository']['name'] == test_repository_2.name


@responses.activate
def test_get_commit_history_json_pushes(test_push, test_repository):
    test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
    parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'
    Push.objects.create(
        revision=parent_revision,
        repository=test_repository,
        author='foo@bar.baz',
        time=datetime.datetime.now(),
    )

    autorel_url = 'https://hg.mozilla.org/{}/json-automationrelevance/{}'.format(
        test_repository.name, test_revision
    )
    responses.add(responses.GET, autorel_url, json={}, content_type='application/json', status=500)

    jsonpushes_commits = {
        'pushes': {
            '108872': {
                'changesets': [
                    {
                        'author': 'Hiro Protagonist <hprotagonist@gmail.com>',
                        'desc': 'Bug 1617666 - Use a separate Debugger to improve performance of eval.',
                        'node': '4fb5e268cf7440332e917e431f14e8bb6dc41a0d',
                        'parents': [parent_revision],
                    }
                ]
            }
        }
    }
    commits_url = '{}/json-pushes?version=2&full=1&changeset={}'.format(
        test_repository.url, test_revision
    )
    responses.add(
        responses.GET,
        commits_url,
        json=jsonpushes_commits,
        content_type='application/json',
        status=200,
    )

    history = get_commit_history(test_repository, test_revision, test_push)
    assert history['parentSha'] == parent_revision
    assert history['parentPushRevision'] == parent_revision
    assert history['parentRepository']['name'] == test_repository.name


@responses.activate
def test_get_commit_history_not_found(test_push, test_repository):
    test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
    # Does not exist as a Push in the DB.
    parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'
    commits_url = '{}/json-pushes?version=2&full=1&changeset={}'.format(
        test_repository.url, test_revision
    )
    commits = {
        'pushes': {
            1: {
                'changesets': [
                    {
                        'author': 'Boris Chiou <boris.chiou@gmail.com>',
                        'backsoutnodes': [],
                        'desc': 'Bug 1612891 - Suppress parsing easing error in early returns of ConvertKeyframeSequence.\n\nWe add a stack based class and supress the exception of parsing easing\nin the destructor, to avoid hitting the potential assertions.\n\nDifferential Revision: https://phabricator.services.mozilla.com/D64268\nDifferential Diff: PHID-DIFF-c4e7dcfpalwiem7bxsnk',
                        'node': '3ca259f9cbdea763e64f10e286e58b271d89ab9d',
                        'parents': [parent_revision],
                    },
                ]
            }
        }
    }

    responses.add(
        responses.GET, commits_url, json=commits, content_type='application/json', status=200
    )

    parent = get_commit_history(test_repository, test_revision, test_push)
    assert parent['parentSha'] == parent_revision
    assert parent['parentPushRevision'] is None
