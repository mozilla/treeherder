from pages.treeherder import Treeherder


def test_switch_app(base_url, selenium, test_repository):
    """Switch between Treeherder and Perfherder using header dropdown"""
    page = Treeherder(selenium, base_url).open()
    assert page.header.active_app == 'Treeherder'
    page = page.switch_to_perfherder()
    assert page.header.active_app == 'Perfherder'
    page = page.switch_to_treeherder()
    # Be aware that when switching back from Perfherder, it will try to
    # default to mozilla-inbound, which does not exist in this test scenario.
    # So part of this test is to ensure what happens when the ``repo`` param
    # in the url is an invalid repo.  We should still display the nav bars
    # and a meaningful error message.
    assert page.header.active_app == 'Treeherder'
