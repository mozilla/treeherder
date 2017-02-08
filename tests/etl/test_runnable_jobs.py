import responses

from treeherder.config.settings import (TASKCLUSTER_INDEX_URL,
                                        TASKCLUSTER_TASKGRAPH_URL)
from treeherder.etl.buildbot import get_symbols_and_platforms
from treeherder.etl.runnable_jobs import (RunnableJobsProcess,
                                          _taskcluster_runnable_jobs)
from treeherder.model.models import (BuildPlatform,
                                     JobType,
                                     MachinePlatform,
                                     Repository,
                                     RunnableJob)


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
    task_id = 'AFq3FRt4TyiTwIN7fUqOQg'
    tc_index_url = TASKCLUSTER_INDEX_URL % repo
    tc_graph_url = TASKCLUSTER_TASKGRAPH_URL.format(task_id=task_id)
    platform = 'plaform name'
    grp_symbol = 'GRP'
    grp_name = 'Group Name'
    symbol = 'sym'
    collection = {'opt': True}
    name = 'job name'
    description = 'job description'

    content1 = {
        'taskId': task_id
    }

    content2 = {
        'node': {
            'task': {
                'extra': {
                    'treeherder': {
                        'groupSymbol': grp_symbol,
                        'groupName': grp_name,
                        'symbol': symbol,
                        'machine': {
                            'platform': platform
                        },
                        'collection':  collection
                    }
                },
                'metadata': {
                    'name': name,
                    'description': description
                }
            }
        }
    }

    responses.add(responses.GET, tc_index_url, json=content1, match_querystring=True, status=200)
    responses.add(responses.GET, tc_graph_url, json=content2, match_querystring=True, status=200)

    jobs_ret = _taskcluster_runnable_jobs(repo, None)

    assert len(jobs_ret) == 1
    test_job = jobs_ret[0]

    assert test_job['build_platform'] == platform
    assert test_job['build_system_type'] == 'taskcluster'
    assert test_job['job_group_name'] == grp_name
    assert test_job['job_group_symbol'] == grp_symbol
    assert test_job['job_type_name'] == name
    assert test_job['job_type_description'] == description
    assert test_job['job_type_symbol'] == symbol
    assert test_job['platform'] == platform
    assert test_job['state'] == 'runnable'
    assert test_job['result'] == 'runnable'
