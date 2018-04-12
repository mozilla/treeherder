import pytest

from pages.treeherder import Treeherder


@pytest.fixture
def commits(create_push, create_commit, test_repository):
    commit = create_commit(create_push(test_repository))
    create_commit(create_push(
        test_repository, revision=commit.revision[::-1], author='bar@foo.com'))


def test_filter_jobs_by_author(base_url, selenium, commits):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.pushes) == 2)
    # check authors are distinct
    assert len(set(push.author for push in page.pushes)) == 2
    author = page.pushes[-1].author
    page.pushes[-1].filter_by_author()
    page.wait.until(lambda _: len(page.pushes) == 1)
    assert page.pushes[0].author == author
    assert len(page.active_filters.filters) == 1
    assert page.active_filters.filters[0].field == 'author:'
    assert page.active_filters.filters[0].value == author.split('@')[0]


def test_clear_filter_jobs_by_author(base_url, selenium, commits):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.pushes) == 2)
    page.pushes[0].filter_by_author()
    page.wait.until(lambda _: len(page.pushes) == 1)
    page.active_filters.filters[0].clear()
    page.wait.until(lambda _: len(page.pushes) == 2)
    # check authors are distinct
    assert len(set(push.author for push in page.pushes)) == 2
