from treeherder.etl.allthethings import RunnableJobsProcess
from treeherder.model.models import RunnableJob, BuildPlatform, MachinePlatform, JobType


def test_prune_old_runnable_job(jm, test_repository, eleven_jobs_stored):

    """

    """
    etl_process = RunnableJobsProcess()

    RunnableJob.objects.create(build_platform=BuildPlatform.objects.all()[0],
                               machine_platform=MachinePlatform.objects.all()[
                                   0],
                               job_type=JobType.objects.all()[0],
                               option_collection_hash='test1',
                               ref_data_name='test1',
                               build_system_type='test1',
                               repository=test_repository)

    etl_process.load({test_repository: ["buildername1"]})
    rj = RunnableJob.objects.all()
    assert len(rj) == 1
    assert rj.ref_data_name == "buildername1"


