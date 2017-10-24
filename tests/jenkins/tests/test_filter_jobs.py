import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_filter_jobs(base_url, selenium):
    """Open resultset page and filter for platform"""
    page = TreeherderPage(selenium, base_url).open()
    platforms = [b.platform_name.lower() for b in page.all_builds]
    assert any(p for p in platforms if 'linux' in p)
    assert any(p for p in platforms if 'windows' in p)

    page.filter_by('linux')
    platforms = [b.platform_name.lower() for b in page.all_builds]
    assert any(p for p in platforms if 'linux' in p)
    assert not any(p for p in platforms if 'windows' in p)
