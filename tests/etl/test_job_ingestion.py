import copy

import pytest

from tests import test_utils
from tests.sample_data_generator import job_data
from treeherder.etl.jobs import _remove_existing_jobs, store_job_data
from treeherder.etl.push import store_push_data
from treeherder.model.models import Job, JobLog


def test_ingest_single_sample_job(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push)
    assert Job.objects.count() == 1
    job = Job.objects.get(id=1)
    # Ensure we don't inadvertently change the way we generate job-related hashes.
    assert job.option_collection_hash == '32faaecac742100f7753f0c1d0aa0add01b4046b'
    assert job.signature.signature == '4dabe44cc898e585228c43ea21337a9b00f5ddf7'


def test_ingest_all_sample_jobs(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """
    Process each job structure in the job_data.txt file and verify.
    """
    job_data = sample_data.job_data
    test_utils.do_job_ingestion(test_repository, job_data, sample_push)


def test_ingest_twice_log_parsing_status_changed(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """Process a single job twice, but change the log parsing status between,
    verify that nothing changes"""
    job_data = sample_data.job_data[:1]

    job_data[0]['job']['state'] = 'running'
    test_utils.do_job_ingestion(test_repository, job_data, sample_push)
    assert JobLog.objects.count() == 1
    for job_log in JobLog.objects.all():
        job_log.update_status(JobLog.FAILED)

    job_data[0]['job']['state'] = 'completed'
    test_utils.do_job_ingestion(test_repository, job_data, sample_push)
    assert JobLog.objects.count() == 1
    for job_log in JobLog.objects.all():
        job_log.status == JobLog.FAILED


@pytest.mark.parametrize("same_ingestion_cycle", [False, True])
def test_ingest_running_to_retry_sample_job(
    test_repository,
    failure_classifications,
    sample_data,
    sample_push,
    mock_log_parser,
    same_ingestion_cycle,
):
    """Process a single job structure in the job_data.txt file"""
    store_push_data(test_repository, sample_push)

    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision'] = sample_push[0]['revision']
    job['state'] = 'running'
    job['result'] = 'unknown'

    def _simulate_retry_job(job):
        job['state'] = 'completed'
        job['result'] = 'retry'
        # convert the job_guid to what it would be on a retry
        job['job_guid'] = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]
        return job

    if same_ingestion_cycle:
        # now we simulate the complete version of the job coming in (on the
        # same push)
        new_job_datum = copy.deepcopy(job_data[0])
        new_job_datum['job'] = _simulate_retry_job(new_job_datum['job'])
        job_data.append(new_job_datum)
        store_job_data(test_repository, job_data)
    else:
        # store the job in the initial state
        store_job_data(test_repository, job_data)

        # now we simulate the complete version of the job coming in and
        # ingest a second time
        job = _simulate_retry_job(job)
        store_job_data(test_repository, job_data)

    assert Job.objects.count() == 1
    job = Job.objects.get(id=1)
    assert job.result == 'retry'
    # guid should be the retry one
    assert job.guid == job_data[-1]['job']['job_guid']


@pytest.mark.parametrize(
    "ingestion_cycles", [[(0, 1), (1, 2), (2, 3)], [(0, 2), (2, 3)], [(0, 3)], [(0, 1), (1, 3)]]
)
def test_ingest_running_to_retry_to_success_sample_job(
    test_repository,
    failure_classifications,
    sample_data,
    sample_push,
    mock_log_parser,
    ingestion_cycles,
):
    # verifies that retries to success work, no matter how jobs are batched
    store_push_data(test_repository, sample_push)

    job_datum = copy.deepcopy(sample_data.job_data[0])
    job_datum['revision'] = sample_push[0]['revision']

    job = job_datum['job']
    job_guid_root = job['job_guid']

    job_data = []
    for (state, result, job_guid) in [
        ('running', 'unknown', job_guid_root),
        ('completed', 'retry', job_guid_root + "_" + str(job['end_timestamp'])[-5:]),
        ('completed', 'success', job_guid_root),
    ]:
        new_job_datum = copy.deepcopy(job_datum)
        new_job_datum['job']['state'] = state
        new_job_datum['job']['result'] = result
        new_job_datum['job']['job_guid'] = job_guid
        job_data.append(new_job_datum)

    for (i, j) in ingestion_cycles:
        store_job_data(test_repository, job_data[i:j])

    assert Job.objects.count() == 2
    assert Job.objects.get(id=1).result == 'retry'
    assert Job.objects.get(id=2).result == 'success'
    assert JobLog.objects.count() == 2


@pytest.mark.parametrize(
    "ingestion_cycles", [[(0, 1), (1, 3), (3, 4)], [(0, 3), (3, 4)], [(0, 2), (2, 4)]]
)
def test_ingest_running_to_retry_to_success_sample_job_multiple_retries(
    test_repository,
    failure_classifications,
    sample_data,
    sample_push,
    mock_log_parser,
    ingestion_cycles,
):
    # this verifies that if we ingest multiple retries:
    # (1) nothing errors out
    # (2) we end up with three jobs (the original + 2 retry jobs)

    store_push_data(test_repository, sample_push)

    job_datum = copy.deepcopy(sample_data.job_data[0])
    job_datum['revision'] = sample_push[0]['revision']

    job = job_datum['job']
    job_guid_root = job['job_guid']

    job_data = []
    for (state, result, job_guid) in [
        ('running', 'unknown', job_guid_root),
        ('completed', 'retry', job_guid_root + "_" + str(job['end_timestamp'])[-5:]),
        ('completed', 'retry', job_guid_root + "_12345"),
        ('completed', 'success', job_guid_root),
    ]:
        new_job_datum = copy.deepcopy(job_datum)
        new_job_datum['job']['state'] = state
        new_job_datum['job']['result'] = result
        new_job_datum['job']['job_guid'] = job_guid
        job_data.append(new_job_datum)

    for (i, j) in ingestion_cycles:
        ins = job_data[i:j]
        store_job_data(test_repository, ins)

    assert Job.objects.count() == 3
    assert Job.objects.get(id=1).result == 'retry'
    assert Job.objects.get(id=2).result == 'retry'
    assert Job.objects.get(id=3).result == 'success'
    assert JobLog.objects.count() == 3


def test_ingest_retry_sample_job_no_running(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """Process a single job structure in the job_data.txt file"""
    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision'] = sample_push[0]['revision']

    store_push_data(test_repository, sample_push)

    # complete version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry
    retry_guid = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]
    job['job_guid'] = retry_guid

    store_job_data(test_repository, job_data)

    assert Job.objects.count() == 1
    job = Job.objects.get(id=1)
    assert job.result == 'retry'
    assert job.guid == retry_guid


def test_bad_date_value_ingestion(
    test_repository, failure_classifications, sample_push, mock_log_parser
):
    """
    Test ingesting a job blob with bad date value

    """
    blob = job_data(start_timestamp="foo", revision=sample_push[0]['revision'])

    store_push_data(test_repository, sample_push[:1])
    store_job_data(test_repository, [blob])
    # if no exception, we are good.


def test_remove_existing_jobs_single_existing(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push)
    assert Job.objects.count() == 1

    data = _remove_existing_jobs(job_data)
    assert data == []


def test_remove_existing_jobs_one_existing_one_new(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push)

    data = _remove_existing_jobs(sample_data.job_data[:2])

    assert len(data) == 1
    assert Job.objects.count() == 1


def test_ingest_job_default_tier(
    test_repository, sample_data, sample_push, failure_classifications, mock_log_parser
):
    """Tier is set to 1 by default"""
    job_data = sample_data.job_data[:1]
    store_push_data(test_repository, sample_push)
    store_job_data(test_repository, job_data)
    job = Job.objects.all().first()
    assert job.tier == 1


def test_ingesting_skip_existing(
    test_repository, failure_classifications, sample_data, sample_push, mock_log_parser
):
    """Remove single existing job prior to loading"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(test_repository, job_data, sample_push)

    store_job_data(test_repository, sample_data.job_data[:2])

    assert Job.objects.count() == 2


def test_ingest_job_with_updated_job_group(
    test_repository, failure_classifications, sample_data, mock_log_parser, push_stored
):
    """
    The job_type and job_group for a job is independent of any other job_type
    and job_group combination.
    """
    first_job_datum = sample_data.job_data[0]
    first_job_datum["job"]["group_name"] = "first group name"
    first_job_datum["job"]["group_symbol"] = "1"
    first_job_guid = "first-unique-job-guid"
    first_job_datum["job"]["job_guid"] = first_job_guid
    first_job_datum["revision"] = push_stored[0]["revision"]
    store_job_data(test_repository, [first_job_datum])
    first_job = Job.objects.get(guid=first_job_guid)

    second_job_datum = copy.deepcopy(first_job_datum)
    # create a new guid to ingest the job again
    second_job_guid = "second-unique-job-guid"
    second_job_datum["job"]["job_guid"] = second_job_guid
    second_job_datum["job"]["group_name"] = "second group name"
    second_job_datum["job"]["group_symbol"] = "2"
    second_job_datum["revision"] = push_stored[0]["revision"]

    store_job_data(test_repository, [second_job_datum])

    second_job = Job.objects.get(guid=second_job_guid)

    assert second_job.job_group.name == second_job_datum["job"]["group_name"]
    assert first_job.job_group.name == first_job_datum["job"]["group_name"]
