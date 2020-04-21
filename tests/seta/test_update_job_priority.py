import pytest
from mock import patch

from treeherder.seta.models import JobPriority
from treeherder.seta.update_job_priority import (
    _initialize_values,
    _sanitize_data,
    _unique_key,
    _update_table,
    query_sanitized_data,
)


def test_unique_key():
    new_job = {
        'build_system_type': 'buildbot',
        'platform': 'windows8-64',
        'platform_option': 'opt',
        'testtype': 'web-platform-tests-1',
    }
    assert _unique_key(new_job), ('web-platform-tests-1', 'opt', 'windows8-64')


def test_sanitize_data(runnable_jobs_data):
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


@patch('treeherder.seta.update_job_priority.list_runnable_jobs')
def test_query_sanitized_data(list_runnable_jobs, runnable_jobs_data, sanitized_data):
    list_runnable_jobs.return_value = runnable_jobs_data
    data = query_sanitized_data()
    assert data == sanitized_data


@pytest.mark.django_db()
def test_initialize_values_no_data():
    results = _initialize_values()
    assert results == ({}, 5, None)


@patch.object(JobPriority, 'save')
@patch('treeherder.seta.update_job_priority._initialize_values')
def test_update_table_empty_table(initial_values, jp_save, sanitized_data):
    '''
    We test that starting from an empty table
    '''
    # This set of values is when we're bootstrapping the service (aka empty table)
    initial_values.return_value = {}, 5, None
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
        'testtype': 'reftest-e10s-2',
    }
    # Before calling update_table the priority is only for TaskCluster
    assert (
        len(
            JobPriority.objects.filter(
                buildsystem='taskcluster',
                buildtype=data['platform_option'],
                platform=data['platform'],
                testtype=data['testtype'],
            )
        )
        == 1
    )
    # We are checking that only 1 job was updated
    ret_val = _update_table([data])
    assert ret_val == (0, 0, 1)
    assert (
        len(
            JobPriority.objects.filter(
                buildsystem='*',
                buildtype=data['platform_option'],
                platform=data['platform'],
                testtype=data['testtype'],
            )
        )
        == 1
    )
