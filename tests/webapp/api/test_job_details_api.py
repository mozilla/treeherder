from django.core.urlresolvers import reverse

from tests.test_utils import create_generic_job
from treeherder.model.models import (Job,
                                     JobDetail,
                                     Repository)


def test_job_details(test_repository, failure_classifications,
                     generic_reference_data, result_set_stored, webapp):
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
    test_repository2 = Repository.objects.create(
        repository_group=test_repository.repository_group,
        name=test_repository.name + '_2',
        dvcs_type=test_repository.dvcs_type,
        url=test_repository.url + '_2',
        codebase=test_repository.codebase)

    i = 1
    for (job_guid, params) in details.iteritems():
        if i < 3:
            repository = test_repository
        else:
            # renumber last
            repository = test_repository2
            i = 1
        print (i, repository)
        job = create_generic_job(job_guid, repository, 1, i,
                                 generic_reference_data)
        JobDetail.objects.create(
            job=job, **params)
        i += 1
    print JobDetail.objects.filter(job__guid='abcd')

    # trying to get them all should return an error
    resp = webapp.get(reverse('jobdetail-list'), expect_errors=True)
    assert resp.status_int == 400

    # filter to just get one guid at a time
    for guid_identifier in ['job_guid', 'job__guid']:
        for (guid, detail) in details.iteritems():
            resp = webapp.get(reverse('jobdetail-list') + '?{}={}'.format(
                guid_identifier, guid))
            assert resp.status_int == 200
            assert len(resp.json['results']) == 1
            result = resp.json['results'][0]
            del result['job_guid']
            del result['job_id']
            assert result == details[guid]

    # filter to get first with (just) job_id
    resp = webapp.get(reverse('jobdetail-list') +
                      '?job_id=1')
    assert resp.status_int == 200
    assert len(resp.json['results']) == 1
    assert set([v['job_guid'] for v in resp.json['results']]) == set(
        ['abcd'])

    # filter to get the first and second with job_id__in and repository
    resp = webapp.get(reverse('jobdetail-list') +
                      '?repository={}&job_id__in=1,2'.format(
                          test_repository.name))
    assert resp.status_int == 200
    assert len(resp.json['results']) == 2
    assert set([v['job_guid'] for v in resp.json['results']]) == set(
        ['abcd', 'efgh'])

    # filter to get the last element with job_id__in and repository
    resp = webapp.get(reverse('jobdetail-list') +
                      '?repository={}&job_id__in=3'.format(
                          test_repository2.name))
    assert resp.status_int == 200
    assert len(resp.json['results']) == 1
    assert set([v['job_guid'] for v in resp.json['results']]) == set(
        ['ijkl'])

    # make sure that filtering by repository with a job id in
    # a different repository returns no results
    resp = webapp.get(reverse('jobdetail-list') +
                      '?repository={}&job_id__in=3'.format(
                          test_repository.name))
    assert resp.status_int == 200
    assert len(resp.json['results']) == 0

    # add an extra one, but filter to just get those with a specific title.
    # we should only have one
    JobDetail.objects.create(title='title2', job=Job.objects.get(guid='abcd'),
                             value='foo')
    resp = webapp.get(reverse('jobdetail-list') +
                      '?title=title&job_guid=abcd')
    print resp.json
    assert resp.status_int == 200
    assert len(resp.json['results']) == 1
    assert set([v['job_guid'] for v in resp.json['results']]) == set(['abcd'])
