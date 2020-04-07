import copy

import pytest
from pages.treeherder import Treeherder


@pytest.fixture
def test_jobs(eleven_job_blobs, create_jobs):
    job_blobs = []
    for guid in [b['job']['job_guid'] for b in eleven_job_blobs]:
        job = copy.deepcopy(eleven_job_blobs[0])
        job['job'].update({
            'job_guid': guid,
            'job_symbol': 'job',
            'group_symbol': 'Group'})
        job_blobs.append(job)
    return create_jobs(job_blobs)


def test_expand_job_group(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_job_groups) == 1)
    group = page.all_job_groups[0]
    assert len(group.jobs) == 0
    group.expand()
    assert len(group.jobs) == len(test_jobs)
