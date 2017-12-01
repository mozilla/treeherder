import responses

from treeherder.config.settings import (TASKCLUSTER_INDEX_URL,
                                        TASKCLUSTER_RUNNABLE_JOBS_URL)
from treeherder.etl.buildbot import get_symbols_and_platforms
from treeherder.etl.runnable_jobs import (RunnableJobsProcess,
                                          _taskcluster_runnable_jobs)
from treeherder.model.models import (BuildPlatform,
                                     JobType,
                                     MachinePlatform,
                                     Repository,
                                     RunnableJob)

TASK_ID = 'AFq3FRt4TyiTwIN7fUqOQg'
CONTENT1 = {'taskId': TASK_ID}
RUNNABLE_JOBS_URL = TASKCLUSTER_RUNNABLE_JOBS_URL.format(task_id=TASK_ID)
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
    'result': 'runnable'
}
RUNNABLE_JOBS_CONTENTS = {
    JOB_NAME: {
        'collection':  {'opt': True},
        'groupName': API_RETURN['job_group_name'],
        'groupSymbol': API_RETURN['job_group_symbol'],
        'platform': API_RETURN['platform'],
        'symbol': API_RETURN['job_type_symbol'],
    }
}


def test_prune_old_runnable_job(test_repository, eleven_jobs_stored):
    """
    Test that a defunct buildername will be pruned
    """
    etl_process = RunnableJobsProcess()

    RunnableJob.objects.create(build_platform=BuildPlatform.objects.first(),
                               machine_platform=MachinePlatform.objects.first(),
                               job_type=JobType.objects.first(),
                               option_collection_hash='test1',
                               ref_data_name='test1',
                               build_system_type='test1',
                               repository=Repository.objects.first())

    buildername = "Android 4.2 x86 Emulator larch opt test androidx86-set-4"
    sym_plat = get_symbols_and_platforms(buildername)
    etl_process.update_runnable_jobs_table({test_repository.name: [sym_plat]})
    rj = RunnableJob.objects.all()
    assert len(rj) == 1

    assert rj[0].ref_data_name == buildername


@responses.activate
def test_taskcluster_runnable_jobs(test_repository):
    """
    Test getting runnable jobs without providing decision task id
    """
    repo = test_repository.name

    responses.add(responses.GET, TASKCLUSTER_INDEX_URL % repo,
                  json=CONTENT1, match_querystring=True, status=200)
    responses.add(responses.GET, RUNNABLE_JOBS_URL,
                  json=RUNNABLE_JOBS_CONTENTS, match_querystring=True, status=200)
    jobs_ret = _taskcluster_runnable_jobs(repo, None)

    assert len(jobs_ret) == 1
    test_job = jobs_ret[0]

    assert test_job == API_RETURN
