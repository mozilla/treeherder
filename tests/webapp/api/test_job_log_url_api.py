from django.core.urlresolvers import reverse

from treeherder.model.models import (Job,
                                     JobLog)


def test_get_job_log_urls(test_repository, result_set_stored, webapp):
    job1 = Job.objects.create(
        repository=test_repository,
        guid='1234',
        push_id=1,
        project_specific_id=1)
    job2 = Job.objects.create(
        repository=test_repository,
        guid='5678',
        push_id=1,
        project_specific_id=2)

    JobLog.objects.create(job=job1,
                          name='test_log_1',
                          url='http://google.com',
                          status=JobLog.PENDING)
    JobLog.objects.create(job=job1,
                          name='test_log_2',
                          url='http://yahoo.com',
                          status=JobLog.PARSED)
    JobLog.objects.create(job=job2,
                          name='test_log_3',
                          url='http://yahoo.com',
                          status=JobLog.PARSED)

    resp = webapp.get(reverse('job-log-url-list',
                      kwargs={"project": test_repository.name}) +
                      '?job_id=1')
    assert resp.status_int == 200
    assert len(resp.json) == 2

    resp = webapp.get(reverse('job-log-url-list',
                      kwargs={"project": test_repository.name}) +
                      '?job_id=1&job_id=2')
    assert resp.status_int == 200
    assert len(resp.json) == 3
