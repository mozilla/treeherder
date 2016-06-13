from treeherder.etl.allthethings import RunnableJobsProcess
from treeherder.model.models import (RunnableJob, BuildPlatform,
                                     MachinePlatform, JobType, Repository)
from django.forms.models import model_to_dict

def test_prune_old_runnable_job(jm, eleven_jobs_stored):

    """

    """
    etl_process = RunnableJobsProcess()

    params = {
        "build_platform": BuildPlatform.objects.first(),
        "machine_platform": MachinePlatform.objects.first(),
        "job_type": JobType.objects.first(),
        "option_collection_hash": 'test1',
        "ref_data_name": 'test1',
        "build_system_type": 'test1',
        "repository": Repository.objects.first()
    }
    RunnableJob.objects.create(**params)

    params["ref_data_name"] = "buildername1"
    for k, v in params.items():
        try:
            params[k] = model_to_dict(v)
        except:
            print("oops " + k)
            print(v)
            pass
    etl_process.load({jm.project: [params]})
    rj = RunnableJob.objects.all()
    assert len(rj) == 1

    assert rj[0].ref_data_name == "buildername1"


