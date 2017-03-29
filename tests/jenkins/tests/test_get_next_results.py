import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_get_next_results(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    assert len(page.result_sets) == 10

    page.get_next_ten_results()
    assert len(page.result_sets) == 20

    page = TreeherderPage(selenium, base_url).open()
    page.get_next_twenty_results()
    assert len(page.result_sets) == 30

    page = TreeherderPage(selenium, base_url).open()
    page.get_next_fifty_results()
    assert len(page.result_sets) == 60
