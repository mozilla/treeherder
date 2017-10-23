import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
@pytest.mark.parametrize('count', ((10), (20), (50)))
def test_get_next_results(base_url, selenium, count):
    page = TreeherderPage(selenium, base_url).open()
    assert len(page.result_sets) == 10
    getattr(page, 'get_next_{}'.format(count))()
    assert len(page.result_sets) == 10 + count
