import datetime

import pytest
from mock import patch

from treeherder.seta.job_priorities import (GECKO_DECISION_TASK_USER_AGENT,
                                            seta_job_scheduling)
from treeherder.seta.models import (DEFAULT_LOW_PRIORITY,
                                    TaskRequest)
from treeherder.seta.runnable_jobs import RunnableJobs


@pytest.mark.django_db()
@patch('treeherder.seta.job_priorities._validate_request', return_value=None)  # Prevent checking the repository name
@patch.object(RunnableJobs, 'query_runnable_jobs')
def test_gecko_decision_task(query_runnable_jobs, validate_request,
                             test_repository, runnable_jobs_data, all_job_priorities_stored):
    '''This is what the gecko decision task calls.'''
    query_runnable_jobs.return_value = runnable_jobs_data['results']
    for i in range(1, DEFAULT_LOW_PRIORITY):
        jobs = seta_job_scheduling(project=test_repository.name,
                                   build_system_type='taskcluster',
                                   user_agent=GECKO_DECISION_TASK_USER_AGENT)
        assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1
        assert TaskRequest.objects.get(repository__name=test_repository.name).counter == i

    # On the DEFAULT_LOW_PRIORITY-th call we should run all jobs by not returning any jobs as low value
    jobs = seta_job_scheduling(project=test_repository.name,
                               build_system_type='taskcluster',
                               user_agent=GECKO_DECISION_TASK_USER_AGENT)
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 0
    assert TaskRequest.objects.get(repository__name=test_repository.name).counter == DEFAULT_LOW_PRIORITY


@pytest.mark.skip('Re-visit this once we decide to use Treeherder for Buildbot')
@pytest.mark.django_db()
@patch.object(RunnableJobs, 'query_runnable_jobs')
def test_case_buildbot(query_runnable_jobs,
                       all_job_priorities_stored, runnable_jobs_data):
    '''This is what the Buildbot masters would call.'''
    # XXX: if we switch Buildbot to using Treeherder we will need to write tests
    #      taking into consideration that the skip value for different platforms is different
    #      Right now the behaviour is as if every platform had the same skip count (aka priority)
    query_runnable_jobs.return_value = runnable_jobs_data['results']
    for i in range(1, DEFAULT_LOW_PRIORITY):
        jobs = seta_job_scheduling(project='mozilla-inbound',
                                   build_system_type='buildbot')
        # Number of low value jobs
        assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1

    jobs = seta_job_scheduling(project='mozilla-inbound',
                               build_system_type='buildbot')
    # XXX: This should be 0, however, we're getting 1
    #      I believe this is related to not having a counter
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 0


@pytest.mark.skip('Once we fix the Buildbot case this will be solved as well.')
@pytest.mark.django_db()
@patch.object(RunnableJobs, 'query_runnable_jobs')
def test_taskcluster(query_runnable_jobs,
                     all_job_priorities_stored, runnable_jobs_data):
    '''This mimics a call for TaskCluster job priorities *not* from the gecko decision task.'''
    query_runnable_jobs.return_value = runnable_jobs_data['results']
    for i in range(1, DEFAULT_LOW_PRIORITY):
        jobs = seta_job_scheduling(project='mozilla-inbound',
                                   build_system_type='taskcluster')
        # Number of low value jobs
        assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1

    jobs = seta_job_scheduling(project='mozilla-inbound',
                               build_system_type='taskcluster')
    # XXX: This should be 0, however, we're getting 1
    #      I believe this is related to not having a counter
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 0
