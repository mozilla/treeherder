import copy
import datetime

from treeherder.etl.jobs import store_job_data
from treeherder.model.models import Push
from treeherder.push_health.builds import get_build_failures


def test_get_build_failures_with_parent(failure_classifications, test_push, test_repository, sample_data, mock_log_parser):
    parent_revision = 'abcdef77949168d16c03a4cba167678b7ab65f76'
    parent_push = Push.objects.create(
        revision=parent_revision,
        repository=test_repository,
        author='foo@bar.baz',
        time=datetime.datetime.now()
    )

    jobs = sample_data.job_data[20:25]

    for blob in jobs:
        blob['revision'] = test_push.revision
        blob['job']['result'] = 'busted'
        blob['job']['taskcluster_task_id'] = 'V3SVuxO8TFy37En_6HcXLs'
        blob['job']['taskcluster_retry_id'] = '0'
    store_job_data(test_repository, jobs)

    parent_jobs = copy.deepcopy(jobs)
    for idx, blob in enumerate(parent_jobs, start=1):
        blob['revision'] = parent_push.revision
        blob['job']['job_guid'] = '{}{}'.format(parent_push.revision, idx)

    store_job_data(test_repository, parent_jobs)

    build_failures = get_build_failures(test_push, parent_push)
    first_build_failure = build_failures[0]

    assert len(build_failures) == 5
    assert first_build_failure['failedInParent']
