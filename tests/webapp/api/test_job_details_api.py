from django.core.urlresolvers import reverse

from treeherder.model.models import (Job,
                                     JobDetail)


def test_job_details(test_repository, webapp):
    details = {
        'abcd': {
            'title': 'title',
            'value': 'value1',
            'url': None
        },
        'efgh': {
            'title': None,
            'value': 'value2',
            'url': None
        },
        'ijkl': {
            'title': 'title3',
            'value': 'value3',
            'url': 'https://localhost/foo'
        }
    }

    # create some job details for some fake jobs
    i = 0
    for (job_guid, params) in details.iteritems():
        print job_guid
        job = Job.objects.create(guid=job_guid,
                                 repository=test_repository,
                                 project_specific_id=i)
        JobDetail.objects.create(
            job=job, **params)
        i += 1
    print JobDetail.objects.filter(job__guid='abcd')
    # get them all
    resp = webapp.get(reverse('jobdetail-list'))
    assert resp.status_int == 200
    assert len(resp.json['results']) == 3
    for result in resp.json['results']:
        job_guid = result['job_guid']
        del result['job_guid']
        assert result == details[job_guid]

    # filter to just get one guid at a time
    for (guid, detail) in details.iteritems():
        resp = webapp.get(reverse('jobdetail-list') + '?job__guid={}'.format(
            guid))
        assert resp.status_int == 200
        assert len(resp.json['results']) == 1
        result = resp.json['results'][0]
        del result['job_guid']
        assert result == details[guid]
