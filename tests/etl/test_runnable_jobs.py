from treeherder.etl.allthethings import RunnableJobsProcess
from treeherder.etl.buildbot import get_symbols_and_platforms
from treeherder.model.models import (BuildPlatform,
                                     JobType,
                                     MachinePlatform,
                                     Repository,
                                     RunnableJob)


def test_prune_old_runnable_job(jm, eleven_jobs_stored):

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
    etl_process.load({jm.project: [sym_plat]})
    rj = RunnableJob.objects.all()
    assert len(rj) == 1

    assert rj[0].ref_data_name == buildername
