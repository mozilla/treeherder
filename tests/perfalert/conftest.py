import pytest


@pytest.fixture
def job_from_try(eleven_job_blobs, create_jobs):
    job_blob = eleven_job_blobs[0]
    job = create_jobs([job_blob])[0]

    job.repository.is_try_repo = True
    job.repository.save()
    return job
