from pages.treeherder import Treeherder


def test_switch_repo(base_url, selenium, test_repository, test_repository_2):
    """Switch to new active watched repo"""
    page = Treeherder(selenium, base_url).open()
    assert test_repository.name == page.active_watched_repo
    page.select_repository(test_repository_2.name)
    assert test_repository_2.name == page.active_watched_repo
