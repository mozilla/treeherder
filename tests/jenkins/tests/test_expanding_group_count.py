import itertools

import pytest

from pages.treeherder import TreeherderPage


@pytest.mark.nondestructive
def test_expanding_group_count(base_url, selenium):
    page = TreeherderPage(selenium, base_url).open()
    all_groups = list(itertools.chain.from_iterable(
        r.job_groups for r in page.result_sets))
    group = next(g for g in all_groups if not g.expanded)
    jobs = group.jobs
    group.expand()
    assert len(group.jobs) > len(jobs)
