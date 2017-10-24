import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_set_as_top_of_range(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    result_sets = page.result_sets
    datestamp = result_sets[1].datestamp
    assert result_sets[0].datestamp != datestamp
    result_sets[1].set_as_top_of_range()
    assert page.result_sets[0].datestamp == datestamp


@pytest.mark.nondestructive
def test_set_as_bottom_of_range(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    result_sets = page.result_sets
    datestamp = result_sets[-2].datestamp
    assert result_sets[-1].datestamp != datestamp
    page.result_sets[-2].set_as_bottom_of_range()
    assert page.result_sets[-1].datestamp == datestamp
