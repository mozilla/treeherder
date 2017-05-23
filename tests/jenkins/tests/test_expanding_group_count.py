import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_expanding_group_count(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    assert len(page.result_sets) > 1
    assert not page.result_sets[0].find_expanded_group_content

    page.result_sets[0].expand_group_count()
    assert page.result_sets[0].find_expanded_group_content
