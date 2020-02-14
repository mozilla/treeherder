import datetime

import pytest
from mock import patch

from treeherder.seta.job_priorities import (SetaError,
                                            seta_job_scheduling)


@pytest.mark.django_db()
@patch('treeherder.seta.job_priorities.SETAJobPriorities._validate_request', return_value=None)
@patch('treeherder.etl.seta.list_runnable_jobs')
def test_gecko_decision_task(runnable_jobs_list, validate_request,
                             test_repository, runnable_jobs_data,
                             all_job_priorities_stored):
    '''
    When the Gecko decision task calls SETA it will return all jobs that are less likely to catch
    a regression (low value jobs).
    '''
    runnable_jobs_list.return_value = runnable_jobs_data
    jobs = seta_job_scheduling(project=test_repository.name,
                               build_system_type='taskcluster')
    assert len(jobs['jobtypes'][str(datetime.date.today())]) == 1


def test_gecko_decision_task_invalid_repo():
    '''
    When the Gecko decision task calls SETA it will return all jobs that are less likely to catch
    a regression (low value jobs).
    '''
    with pytest.raises(SetaError) as exception_info:
        seta_job_scheduling(project='mozilla-repo-x', build_system_type='taskcluster')

    assert str(exception_info.value) == "The specified project repo 'mozilla-repo-x' " \
                                        "is not supported by SETA."
