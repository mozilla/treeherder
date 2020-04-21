from django.urls import reverse

from treeherder.model.models import BugJobMap


def test_failures(bug_data, client):
    expected = [{'bug_count': 1, 'bug_id': bug_data['bug_id']}]

    resp = client.get(reverse('failures') + bug_data['query_string'])
    assert resp.status_code == 200
    assert resp.json() == expected


def test_failures_by_bug(bug_data, client):
    expected = [
        {
            'bug_id': bug_data['bug_id'],
            'build_type': bug_data['option'].name,
            'job_id': bug_data['job'].id,
            'push_time': bug_data['job'].push.time.strftime('%Y-%m-%d %H:%M:%S'),
            'platform': bug_data['job'].machine_platform.platform,
            'revision': bug_data['job'].push.revision,
            'test_suite': bug_data['job'].signature.job_type_name,
            'tree': bug_data['job'].repository.name,
            'machine_name': bug_data['job'].machine.name,
            'lines': [],
        }
    ]

    resp = client.get(
        reverse('failures-by-bug') + bug_data['query_string'] + '&bug={}'.format(bug_data['bug_id'])
    )
    assert resp.status_code == 200
    assert resp.json() == expected


def test_failure_count_by_bug(bug_data, client, test_run_data):
    failure_count = 0
    bugs = list(BugJobMap.objects.all())

    for bug in bugs:
        if (
            bug.job.repository.name == bug_data['tree']
            and bug.bug_id == bug_data['bug_id']
            and bug.job.push.time.strftime('%Y-%m-%d') == test_run_data['push_time']
        ):
            failure_count += 1

    expected = {
        'date': test_run_data['push_time'],
        'test_runs': test_run_data['test_runs'],
        'failure_count': failure_count,
    }

    resp = client.get(
        reverse('failure-count') + bug_data['query_string'] + '&bug={}'.format(bug_data['bug_id'])
    )
    assert resp.status_code == 200
    assert resp.json()[0] == expected


def test_failure_count(bug_data, client, test_run_data):
    failure_count = 0

    for job in list(bug_data['jobs']):
        if (
            job.repository.name == bug_data['tree']
            and job.failure_classification_id == 4
            and job.push.time.strftime('%Y-%m-%d') == test_run_data['push_time']
        ):
            failure_count += 1

    expected = {
        'date': test_run_data['push_time'],
        'test_runs': test_run_data['test_runs'],
        'failure_count': failure_count,
    }

    resp = client.get(reverse('failure-count') + bug_data['query_string'])
    assert resp.status_code == 200
    assert resp.json()[0] == expected
