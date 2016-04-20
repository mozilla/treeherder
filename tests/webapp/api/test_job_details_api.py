from django.core.urlresolvers import reverse

from treeherder.jobs.models import JobDetail


def test_job_details(transactional_db, webapp):
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
    for (job_guid, params) in details.iteritems():
        JobDetail.objects.create(
            job_guid=job_guid, **params)

    resp = webapp.get(reverse('jobdetail-list'))
    assert resp.status_int == 200
    assert len(resp.json['results']) == 3
    for result in resp.json['results']:
        job_guid = result['job_guid']
        del result['job_guid']
        assert result == details[job_guid]
