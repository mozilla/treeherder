import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_switch_repo(base_url, selenium):
    """Switch to new active watched repo"""
    page = TreeherderPage(selenium, base_url).open()
    assert 'mozilla-inbound' == page.active_watched_repo
    page.select_mozilla_central_repo()
    assert 'mozilla-central' == page.active_watched_repo
