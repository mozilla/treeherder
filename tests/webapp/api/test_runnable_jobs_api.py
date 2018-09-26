from django.conf import settings
from django.urls import reverse
from mock import patch


# _taskcluster_runnable_jobs() is tested in test_taskcluster_runnable_jobs(),
# so mocking here is fine, given the API only counts/wraps the results.
@patch('treeherder.etl.runnable_jobs._taskcluster_runnable_jobs', return_value=[{'foo': 'bar'}])
def test_runnable_jobs_api(_taskcluster_runnable_jobs, client):
    project_name = settings.TREEHERDER_TEST_REPOSITORY_NAME
    url = reverse('runnable_jobs-list', kwargs={'project': project_name})
    resp = client.get(url)

    _taskcluster_runnable_jobs.assert_called_with(project_name, None)
    assert resp.status_code == 200
    assert resp.json() == {
        'meta': {
            'count': 1,
            'offset': 0,
            'repository': project_name,
        },
        'results': [{
            'foo': 'bar',
        }],
    }
