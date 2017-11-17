from pages.treeherder import Treeherder


def test_switch_repo(base_url, selenium):
    """Switch to new active watched repo"""
    page = Treeherder(selenium, base_url).open()
    assert 'mozilla-inbound' == page.active_watched_repo
    page.select_mozilla_central_repo()
    assert 'mozilla-central' == page.active_watched_repo
