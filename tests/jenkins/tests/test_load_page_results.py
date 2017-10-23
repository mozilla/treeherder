import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_load_next_results(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    assert len(page.result_sets) == 10

    page.get_next_10()
    assert len(page.result_sets) == 20

    page.get_next_20()
    page.wait_for_page_to_load()
    assert len(page.result_sets) == 40

    page.get_next_50()
    assert len(page.result_sets) == 90
