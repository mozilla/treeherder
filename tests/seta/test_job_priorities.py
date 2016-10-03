import datetime

import pytest
from mock import patch

from treeherder.seta.job_priorities import (GECKO_DECISION_TASK_USER_AGENT,
                                            seta_job_scheduling)
from treeherder.seta.runnable_jobs import RunnableJobs


@patch.object(RunnableJobs, 'query_runnable_jobs')
@patch('treeherder.seta.job_priorities._update_task_request')
def test_gecko_decision_task(_update_task_request, query_runnable_jobs,
                             task_request, runnable_jobs_data, all_job_priorities_stored):
    '''This is what the gecko decision task calls.'''
    # XXX: Get rid of this once task_request is stored in the db
    _update_task_request.return_value = task_request
    query_runnable_jobs.return_value = runnable_jobs_data['results']
    jobs = seta_job_scheduling(project='mozilla-inbound',
                               build_system_type='taskcluster',
                               user_agent=GECKO_DECISION_TASK_USER_AGENT)
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1


@pytest.mark.django_db()
@patch.object(RunnableJobs, 'query_runnable_jobs')
def test_case_buildbot(query_runnable_jobs,
                       all_job_priorities_stored, runnable_jobs_data):
    '''This is what the Buildbot masters would call.'''
    query_runnable_jobs.return_value = runnable_jobs_data['results']
    jobs = seta_job_scheduling(project='mozilla-inbound',
                               build_system_type='buildbot')
    # Number of low value jobs
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1


@pytest.mark.django_db()
@patch.object(RunnableJobs, 'query_runnable_jobs')
def test_taskcluster(query_runnable_jobs,
                     all_job_priorities_stored, runnable_jobs_data):
    '''This mimics a call for TaskCluster job priorities *not* from the gecko decision task.'''
    query_runnable_jobs.return_value = runnable_jobs_data['results']
    jobs = seta_job_scheduling(project='mozilla-inbound',
                               build_system_type='taskcluster')
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1
