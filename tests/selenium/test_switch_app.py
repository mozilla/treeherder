from pages.treeherder import Treeherder


def test_switch_app(base_url, selenium, test_repository):
    """Switch between Treeherder and Perfherder using header dropdown"""
    page = Treeherder(selenium, base_url).open()
    assert page.header.active_app == 'Treeherder'
    page = page.switch_to_perfherder()
    assert page.header.active_app == 'Perfherder'
    page = page.switch_to_treeherder()
    assert page.header.active_app == 'Treeherder'
