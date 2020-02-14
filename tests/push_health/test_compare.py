import datetime

import responses

from treeherder.model.models import Push
from treeherder.push_health.compare import (get_parent,
                                            get_response_object)


def test_get_response_object(test_push, test_repository):
    resp = get_response_object('1234', test_push, test_repository)
    assert resp['parentSha'] == '1234'
    assert resp['id'] == 1
    assert resp['exactMatch'] is False
    assert resp['revision'] == '4c45a777949168d16c03a4cba167678b7ab65f76'


@responses.activate
def test_get_parent(test_push, test_repository):
    test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
    parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'
    Push.objects.create(
        revision=parent_revision,
        repository=test_repository,
        author='foo@bar.baz',
        time=datetime.datetime.now()
    )
    commits_url = '{}/json-pushes?version=2&full=1&changeset={}'.format(
        test_repository.url, test_revision)
    commits = {'pushes': {1: {'changesets': [{'parents': [parent_revision]}]}}}

    responses.add(responses.GET, commits_url, json=commits, content_type='application/json', status=200)

    parent = get_parent(test_repository, test_revision, test_push)
    assert parent['parentSha'] == parent_revision
    assert parent['revision'] == parent_revision


@responses.activate
def test_get_parent_not_found(test_push, test_repository):
    test_revision = '4c45a777949168d16c03a4cba167678b7ab65f76'
    # Does not exist as a Push in the DB.
    parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'
    commits_url = '{}/json-pushes?version=2&full=1&changeset={}'.format(
        test_repository.url, test_revision)
    commits = {'pushes': {1: {'changesets': [{'parents': [parent_revision]}]}}}

    responses.add(responses.GET, commits_url, json=commits, content_type='application/json', status=200)

    parent = get_parent(test_repository, test_revision, test_push)
    assert parent['parentSha'] == parent_revision
    assert parent['revision'] is None
