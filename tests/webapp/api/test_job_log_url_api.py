from django.urls import reverse

from tests.test_utils import create_generic_job
from treeherder.model.models import JobLog


def test_get_job_log_urls(
    test_repository, push_stored, failure_classifications, generic_reference_data, client
):
    job1 = create_generic_job('1234', test_repository, 1, generic_reference_data)
    job2 = create_generic_job('5678', test_repository, 1, generic_reference_data)

    JobLog.objects.create(
        job=job1, name='test_log_1', url='http://google.com', status=JobLog.PENDING
    )
    JobLog.objects.create(job=job1, name='test_log_2', url='http://yahoo.com', status=JobLog.PARSED)
    JobLog.objects.create(job=job2, name='test_log_3', url='http://yahoo.com', status=JobLog.PARSED)

    resp = client.get(
        reverse('job-log-url-list', kwargs={"project": test_repository.name}) + '?job_id=1'
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    resp = client.get(
        reverse('job-log-url-list', kwargs={"project": test_repository.name}) + '?job_id=1&job_id=2'
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 3
