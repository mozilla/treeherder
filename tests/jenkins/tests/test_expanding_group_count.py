import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_expanding_group_count(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    group = next(g for g in page.result_sets[0].job_groups if not g.expanded)
    jobs = group.jobs
    group.expand()
    assert len(group.jobs) > len(jobs)
