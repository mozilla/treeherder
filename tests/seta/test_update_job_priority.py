import datetime

import pytest
from mock import patch

from treeherder.seta.models import JobPriority
from treeherder.seta.runnable_jobs import RunnableJobsClient
from treeherder.seta.update_job_priority import (_initialize_values,
                                                 _sanitize_data,
                                                 _unique_key,
                                                 _update_table,
                                                 query_sanitized_data)


def test_unique_key():
    new_job = {
        'build_system_type': 'buildbot',
        'platform': 'windows8-64',
        'platform_option': 'opt',
        'testtype': 'web-platform-tests-1'
    }
    assert _unique_key(new_job), ('web-platform-tests-1', 'opt', 'windows8-64')


def test_sanitize_data(runnable_jobs_data):
    assert len(runnable_jobs_data['results']) == runnable_jobs_data['meta']['count']
    data = _sanitize_data(runnable_jobs_data)
    bb_jobs = 0
    tc_jobs = 0
    for datum in data:
        if datum['build_system_type'] in ('taskcluster', '*'):
            tc_jobs += 1
        if datum['build_system_type'] in ('buildbot', '*'):
            bb_jobs += 1

    assert bb_jobs == 2
    assert tc_jobs == 2


@patch.object(RunnableJobsClient, '_query_latest_gecko_decision_task_id')
@patch.object(RunnableJobsClient, 'query_runnable_jobs')
def test_query_sanitized_data(query_runnable_jobs, query_task_id,
                              runnable_jobs_data, sanitized_data):
    query_runnable_jobs.return_value = runnable_jobs_data
    query_task_id.return_value = 'MOCKED'
    data = query_sanitized_data()
    assert data == sanitized_data


@pytest.mark.django_db()
def test_initialize_values_no_data():
    results = _initialize_values()
    assert results == ({}, 5, 5400, None)


@pytest.mark.django_db()
@patch.object(JobPriority.objects, 'all')
@patch('treeherder.seta.update_job_priority._two_weeks_from_now')
def test_initialize_values(two_weeks, jp_all,
                           job_priority_list, jp_index_fixture):
    fourteen_days = datetime.datetime.now() + datetime.timedelta(days=14)
    two_weeks.return_value = fourteen_days
    jp_all.return_value = job_priority_list
    assert _initialize_values() == (jp_index_fixture, 1, 0, fourteen_days)


@patch('treeherder.seta.update_job_priority._two_weeks_from_now')
@patch('treeherder.seta.update_job_priority._initialize_values')
def test_update_table_no_new_jobs(initial_values, two_weeks,
                                  job_priority_list, jp_index_fixture, sanitized_data):
    '''
    We test that once a table has information about job priorities future calls with the same data will not change the table
    '''
    # By doing this we won't need DB access
    initial_values.return_value = jp_index_fixture, 1, 0, two_weeks
    assert _update_table(sanitized_data) == (0, 0, 0)


@patch.object(JobPriority, 'save')
@patch('treeherder.seta.update_job_priority._initialize_values')
def test_update_table_empty_table(initial_values, jp_save,
                                  sanitized_data):
    '''
    We test that starting from an empty table
    '''
    # This set of values is when we're bootstrapping the service (aka empty table)
    initial_values.return_value = {}, 5, 5400, None
    jp_save.return_value = None  # Since we don't want to write to the DB
    assert _update_table(sanitized_data) == (3, 0, 0)


@pytest.mark.django_db()
def test_update_table_job_from_other_buildsysten(all_job_priorities_stored):
    # We already have a TaskCluster job like this in the DB
    # The DB entry should be changed to '*'
    data = {
        'build_system_type': 'buildbot',
        'platform': 'linux64',
        'platform_option': 'opt',
        'testtype': 'reftest-e10s-2'
    }
    # Before calling update_table the priority is only for TaskCluster
    assert len(JobPriority.objects.filter(
            buildsystem='taskcluster',
            buildtype=data['platform_option'],
            platform=data['platform'],
            testtype=data['testtype'],
    )) == 1
    # We are checking that only 1 job was updated
    ret_val = _update_table([data])
    assert ret_val == (0, 0, 1)
    assert len(JobPriority.objects.filter(
            buildsystem='*',
            buildtype=data['platform_option'],
            platform=data['platform'],
            testtype=data['testtype'],
    )) == 1
