import copy

import pytest

from pages.treeherder import Treeherder
from treeherder.etl.jobs import store_job_data
from treeherder.model.models import Job


@pytest.fixture
def test_jobs(eleven_job_blobs, failure_classifications, test_repository):
    job_blobs = []
    for guid in [b['job']['job_guid'] for b in eleven_job_blobs]:
        job = copy.deepcopy(eleven_job_blobs[0])
        job['job'].update({
            'job_guid': guid,
            'job_symbol': 'job',
            'group_symbol': 'Group'})
        job_blobs.append(job)
    store_job_data(test_repository, job_blobs)
    return [Job.objects.get(id=i) for i in range(1, len(job_blobs) + 1)]


def test_expand_job_group(base_url, selenium, test_jobs):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: len(page.all_job_groups) == 1)
    group = page.all_job_groups[0]
    assert len(group.jobs) == 0
    group.expand()
    assert len(group.jobs) == len(test_jobs)
