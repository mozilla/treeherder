import pytest
from mock import patch

from treeherder.seta.update_job_priority import ManageJobPriorityTable


# Prevent requests to be used in any of the tests
@pytest.fixture(autouse=True)
def no_requests(monkeypatch):
    monkeypatch.delattr("requests.sessions.Session.request")

TRANSFORMED_DATA = [{
    'platform_option': 'debug',
    'platform': 'windows8-64',
    'build_system_type': 'buildbot',
    'testtype': 'web-platform-tests-1'
}, {
    'platform_option': 'opt',
    'platform': 'linux32',
    'build_system_type': '*',
    'testtype': 'reftest-e10s-1'
}]


def test_unique_key(job_priority_table_manager):
    new_job = {
        'build_system_type': 'buildbot',
        'platform': 'windows8-64',
        'platform_option': 'opt',
        'testtype': 'web-platform-tests-1'
    }
    key = job_priority_table_manager._unique_key(new_job)
    assert key == ('web-platform-tests-1', 'opt', 'windows8-64')


def test_sanitized_data(job_priority_table_manager, runnable_jobs_data):
    assert len(runnable_jobs_data['results']) == runnable_jobs_data['meta']['count']
    data = job_priority_table_manager.sanitized_data(runnable_jobs_data)
    # 1 job is Buildbot only, 2 jobs are running on both buildsystems (thus '*')
    # and the last one is a build job (disregarded)
    assert len(data) == 2
    assert data[0]['build_system_type'] == 'buildbot'
    assert data[1]['build_system_type'] == '*'
    assert sorted(data[0].keys()) == ['build_system_type', 'platform', 'platform_option', 'testtype']


def test_sanitized_data_empty_runnable_data(job_priority_table_manager):
    assert job_priority_table_manager.sanitized_data(None) == []


@patch.object(ManageJobPriorityTable, '_query_latest_gecko_decision_task_id')
@patch.object(ManageJobPriorityTable, 'query_runnable_jobs')
def test_query_sanitized_data(query_runnable_jobs, query_task_id,
                              job_priority_table_manager, runnable_jobs_data, test_setup):
    query_runnable_jobs.return_value = runnable_jobs_data
    query_task_id.return_value = 'MOCKED'
    data = job_priority_table_manager.query_sanitized_data()
    assert data == TRANSFORMED_DATA
