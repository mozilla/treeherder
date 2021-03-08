from unittest.mock import MagicMock

import pytest
import taskcluster

from treeherder.services.taskcluster import notify_client_factory

from tests.conftest import SampleDataJSONLoader

load_json_fixture = SampleDataJSONLoader('perf_sheriff_bot')


@pytest.fixture
def job_from_try(eleven_job_blobs, create_jobs):
    job_blob = eleven_job_blobs[0]
    job = create_jobs([job_blob])[0]

    job.repository.is_try_repo = True
    job.repository.save()
    return job


@pytest.fixture
def notify_client_mock() -> taskcluster.Notify:
    return MagicMock(
        spec=notify_client_factory('https://fakerooturl.org', 'FAKE_CLIENT_ID', 'FAKE_ACCESS_TOKEN')
    )
