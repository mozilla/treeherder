import os

import pytest
import simplejson as json

from treeherder.etl.jobs import store_job_data

base_dir = os.path.dirname(__file__)


@pytest.fixture
def pending_job():
    """returns a list of buildapi pending jobs"""
    with open(os.path.join(base_dir, "pending.json")) as f:
        return json.load(f)


@pytest.fixture
def running_job():
    """returns a list of buildapi running jobs"""
    with open(os.path.join(base_dir, "running.json")) as f:
        return json.load(f)


@pytest.fixture
def completed_job():
    """returns a list of buildapi completed jobs"""
    with open(os.path.join(base_dir, "finished.json")) as f:
        return json.load(f)


@pytest.fixture
def pending_jobs_stored(test_repository, failure_classifications, pending_job, push_stored):
    """
    stores a list of buildapi pending jobs into the jobs store
    """
    pending_job.update(push_stored[0])
    pending_job.update({'project': test_repository.name})
    store_job_data(test_repository, [pending_job])


@pytest.fixture
def running_jobs_stored(test_repository, failure_classifications, running_job, push_stored):
    """
    stores a list of buildapi running jobs
    """
    running_job.update(push_stored[0])
    running_job.update({'project': test_repository.name})
    store_job_data(test_repository, [running_job])


@pytest.fixture
def completed_jobs_stored(test_repository, failure_classifications, completed_job, push_stored):
    """
    stores a list of buildapi completed jobs
    """
    completed_job['revision'] = push_stored[0]['revision']
    completed_job.update({'project': test_repository.name})
    store_job_data(test_repository, [completed_job])
