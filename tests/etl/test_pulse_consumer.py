from treeherder.etl import pulse_consumer
from treeherder.model.derived.artifacts import ArtifactsModel


def test_validate_jobs(sample_data, test_project, jm, result_set_stored):
    """
    Ensure the pending job with the missing resultset is queued for refetching
    """
    revision = result_set_stored[0]["revisions"][0]["revision"]
    sample_jobs = sample_data.pulse_jobs
    for job in sample_jobs:
        job["origin"]["project"] = test_project
        job["origin"]["revision"] = revision

    jpc = pulse_consumer.JobLoader()

    jpc.process_job_list(sample_jobs, raise_errors=True)

    jobs = jm.get_job_list(0, 10)
    import pprint
    pprint.pprint(jobs)
    assert len(jobs) == 1

    logs = jm.get_job_log_url_list([jobs[0]["id"]])
    assert len(logs) == 1
    with ArtifactsModel(test_project) as am:
        artifacts = am.get_job_artifact_list(0, 10)
        assert len(artifacts) == 1
