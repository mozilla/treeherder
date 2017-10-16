import pytest

from pages.treeherder import TreeherderPage


def platforms(result_set):
    parts = []
    for build in result_set.builds:
        parts.extend(build.platform_name.lower().split())
    return set(parts)


def linux_and_windows(result_set):
    return {'linux', 'windows'}.issubset(platforms(result_set))


@pytest.mark.nondestructive
def test_filter_jobs(base_url, selenium):
    """Open resultset page and filter for platform"""
    page = TreeherderPage(selenium, base_url).open()
    # select the first result set with linux and windows platforms
    result_set = next(r for r in page.result_sets if linux_and_windows(r))
    assert {'linux', 'windows'}.issubset(platforms(result_set))
    page.filter_by('linux')
    assert 'linux' in platforms(result_set)
    assert 'windows' not in platforms(result_set)
