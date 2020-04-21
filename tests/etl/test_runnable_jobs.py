import responses

from treeherder.etl.runnable_jobs import (
    RUNNABLE_JOBS_URL,
    TASKCLUSTER_INDEX_URL,
    _taskcluster_runnable_jobs,
)

TASK_ID = 'AFq3FRt4TyiTwIN7fUqOQg'
CONTENT1 = {'taskId': TASK_ID}
RUNNABLE_JOBS_URL = RUNNABLE_JOBS_URL.format(task_id=TASK_ID, run_number=0)
JOB_NAME = 'job name'
API_RETURN = {
    'build_platform': 'plaform name',
    'build_system_type': 'taskcluster',
    'job_group_name': 'Group Name',
    'job_group_symbol': 'GRP',
    'job_type_name': JOB_NAME,
    'job_type_symbol': 'sym',
    'platform': 'plaform name',
    'platform_option': 'opt',
    'ref_data_name': JOB_NAME,
    'state': 'runnable',
    'result': 'runnable',
}
RUNNABLE_JOBS_CONTENTS = {
    JOB_NAME: {
        'collection': {'opt': True},
        'groupName': API_RETURN['job_group_name'],
        'groupSymbol': API_RETURN['job_group_symbol'],
        'platform': API_RETURN['platform'],
        'symbol': API_RETURN['job_type_symbol'],
    }
}


@responses.activate
def test_taskcluster_runnable_jobs(test_repository):
    """
    Test getting runnable jobs without providing decision task id
    """
    repo = test_repository.name

    responses.add(
        responses.GET,
        TASKCLUSTER_INDEX_URL % repo,
        json=CONTENT1,
        match_querystring=True,
        status=200,
    )
    responses.add(
        responses.GET,
        RUNNABLE_JOBS_URL,
        json=RUNNABLE_JOBS_CONTENTS,
        match_querystring=True,
        status=200,
    )
    jobs_ret = _taskcluster_runnable_jobs(repo)

    assert len(jobs_ret) == 1
    test_job = jobs_ret[0]

    assert test_job == API_RETURN
