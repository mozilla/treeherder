import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_jobs(base_url, selenium):
    """Open resultset page and filter for platform"""
    page = TreeherderPage(selenium, base_url).open()
    assert any(r.contains_platform('linux') for r in page.pushes)
    assert any(r.contains_platform('windows') for r in page.pushes)

    page.filter_by('linux')
    assert any(r.contains_platform('linux') for r in page.pushes)
    assert not any(r.contains_platform('windows') for r in page.pushes)
