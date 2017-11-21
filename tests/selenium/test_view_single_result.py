import datetime

import pytest

from pages.treeherder import Treeherder
from treeherder.model.models import (Commit,
                                     Push,
                                     Repository)


@pytest.fixture
def repository():
    return Repository.objects.get(name='mozilla-inbound')


@pytest.fixture
def push(repository):
    return Push.objects.create(
        repository=repository,
        revision="4c45a777949168d16c03a4cba167678b7ab65f76",
        author="foo@bar.com",
        time=datetime.datetime.now())


@pytest.fixture
def commit(push):
    return Commit.objects.create(
        push=push,
        revision=push.revision,
        author=push.author,
        comments="Bug 12345 - This is a message")


def test_open_single_result(base_url, selenium, commit):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: 1 == len(page.result_sets))
    page.result_sets[0].view()
    assert 1 == len(page.result_sets)
    assert commit.author == page.result_sets[0].author
    assert commit.push.time.strftime('%a %b %-d, %H:%M:%S') == page.result_sets[0].datestamp
    assert 1 == len(page.result_sets[0].commits)
    assert commit.revision[:12] == page.result_sets[0].commits[0].revision
    assert commit.comments == page.result_sets[0].commits[0].comment
