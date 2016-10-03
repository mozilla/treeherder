import datetime

import pytest
from mock import patch

from treeherder.config.settings import SETA_LOW_VALUE_PRIORITY
from treeherder.seta.job_priorities import (GECKO_DECISION_TASK_USER_AGENT,
                                            seta_job_scheduling)
from treeherder.seta.models import TaskRequest
from treeherder.seta.runnable_jobs import RunnableJobsClient


@pytest.mark.django_db()
@patch('treeherder.seta.job_priorities._validate_request', return_value=None)  # Prevent checking the repository name
@patch.object(RunnableJobsClient, 'query_runnable_jobs')
def test_gecko_decision_task(query_runnable_jobs, validate_request,
                             test_repository, runnable_jobs_data, all_job_priorities_stored):
    '''
    When the Gecko decision task calls SETA it will do so by setting GECKO_DECISION_TASK_USER_AGENT as the
    request's user agent.

    Every time the Gecko decision task calls this API we increase the counter for this specific project.

    On most calls we will return all jobs that are less likely to catch a regression (low value jobs).
    However, once the Gecko decision task has called the API API SETA_LOW_VALUE_PRIORITY times we will return no jobs.
    This is interpreted by the Gecko decision task that it should run everything.
    '''
    query_runnable_jobs.return_value = runnable_jobs_data
    for i in range(1, SETA_LOW_VALUE_PRIORITY):
        jobs = seta_job_scheduling(project=test_repository.name,
                                   build_system_type='taskcluster',
                                   user_agent=GECKO_DECISION_TASK_USER_AGENT)
        assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1
        assert TaskRequest.objects.get(repository__name=test_repository.name).counter == i

    # On the SETA_LOW_VALUE_PRIORITY-th call we should run all jobs by not returning any jobs as low value
    jobs = seta_job_scheduling(project=test_repository.name,
                               build_system_type='taskcluster',
                               user_agent=GECKO_DECISION_TASK_USER_AGENT)
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 0
    assert TaskRequest.objects.get(repository__name=test_repository.name).counter == SETA_LOW_VALUE_PRIORITY
