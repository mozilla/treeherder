import pytest

from tests.conftest import SampleDataJSONLoader

load_json_fixture = SampleDataJSONLoader('perf_sheriff_bot')


@pytest.fixture
def job_from_try(eleven_job_blobs, create_jobs):
    job_blob = eleven_job_blobs[0]
    job = create_jobs([job_blob])[0]

    job.repository.is_try_repo = True
    job.repository.save()
    return job


@pytest.fixture(scope="module")
def record_context_sample():
    # contains 5 data points that can be backfilled
    return load_json_fixture('recordContext.json')
