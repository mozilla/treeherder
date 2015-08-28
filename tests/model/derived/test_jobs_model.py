import copy
import json
import threading
import time
import zlib

import pytest
from django.conf import settings
from django.core.management import call_command

from tests import test_utils
from tests.sample_data_generator import job_data, result_set
from treeherder.model.derived import ArtifactsModel
from treeherder.model.derived.jobs import JobsModel

slow = pytest.mark.slow
xfail = pytest.mark.xfail


class FakePerfData(object):
    SERIES = [{'geomean': 1, 'result_set_id': 1,
              'push_timestamp': int(time.time())}]
    TIME_INTERVAL = 86400
    SIGNATURE = 'cheezburger'
    SERIES_TYPE = 'talos_data'

    @staticmethod
    def get_fake_lock_string():
        return 'sps_{}_{}_{}'.format(FakePerfData.TIME_INTERVAL,
                                     FakePerfData.SERIES_TYPE,
                                     FakePerfData.SIGNATURE)


def test_unicode(jm):
    """Unicode representation of a ``JobModel`` is the project name."""
    assert unicode(jm) == unicode(jm.project)

    jm.disconnect()


def test_disconnect(jm):
    """test that your model disconnects"""

    # establish the connection to jobs.
    jm._get_last_insert_id()

    jm.disconnect()
    assert not jm.get_dhub().connection["master_host"]["con_obj"].open


def test_ingest_single_sample_job(jm, refdata, sample_data, initial_data,
                                  mock_log_parser, sample_resultset):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    jm.disconnect()
    refdata.disconnect()


def test_ingest_all_sample_jobs(jm, refdata, sample_data, initial_data, sample_resultset, mock_log_parser):
    """
    @@@ - Re-enable when our job_data.txt has been re-created with
          correct data.

    Process each job structure in the job_data.txt file and verify.

    """
    job_data = sample_data.job_data
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    jm.disconnect()
    refdata.disconnect()


def test_get_inserted_row_ids(jm, sample_resultset, test_repository):

    slice_limit = 8
    sample_slice = sample_resultset[0:slice_limit]
    new_id_set = set(range(1, len(sample_slice) + 1))

    data = jm.store_result_set_data(sample_slice)

    # Confirm the range of ids matches for the sample_resultset slice
    assert set(data['inserted_result_set_ids']) == new_id_set

    second_pass_data = jm.store_result_set_data(sample_slice)

    # Confirm if we store the same data twice we don't identify new
    # result set ids
    assert second_pass_data['inserted_result_set_ids'] == []

    third_pass_data = jm.store_result_set_data(sample_resultset)

    # Confirm if we store a mix of new result sets and already stored
    # result sets we store/identify the new ones
    assert len(third_pass_data['inserted_result_set_ids']) == \
        len(sample_resultset) - slice_limit


def test_ingest_running_to_retry_sample_job(jm, refdata, sample_data, initial_data,
                                            mock_log_parser, sample_resultset):
    """Process a single job structure in the job_data.txt file"""
    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision_hash'] = sample_resultset[0]['revision_hash']

    jm.store_result_set_data(sample_resultset)

    job['state'] = 'running'
    job['result'] = 'unknown'

    # for pending and running jobs, we call this directly, just like
    # the web api does.
    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 1)
    initial_job_id = jl[0]["id"]

    # now we simulate the complete version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry
    job['job_guid'] = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)
    jl = jm.get_job_list(0, 10)

    jm.disconnect()
    refdata.disconnect()

    assert len(jl) == 1
    assert jl[0]['result'] == 'retry'
    assert jl[0]['id'] == initial_job_id


def test_ingest_running_to_retry_to_success_sample_job(jm, refdata, sample_data, initial_data,
                                                       mock_log_parser, sample_resultset):
    """Process a single job structure in the job_data.txt file"""
    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision_hash'] = sample_resultset[0]['revision_hash']
    job_guid_root = job['job_guid']

    jm.store_result_set_data(sample_resultset)

    job['state'] = 'running'
    job['result'] = 'unknown'
    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 1)
    initial_job_id = jl[0]["id"]

    # now we simulate the complete RETRY version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry
    job['job_guid'] = job_guid_root + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)

    # now we simulate the complete SUCCESS version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'success'
    # convert the job_guid to the normal root style
    job['job_guid'] = job_guid_root

    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 10)

    jm.disconnect()
    refdata.disconnect()

    assert len(jl) == 2
    assert jl[0]['result'] == 'retry'
    assert jl[0]['id'] == initial_job_id
    assert jl[1]['result'] == 'success'


def test_ingest_retry_sample_job_no_running(jm, refdata, sample_data, initial_data,
                                            mock_log_parser, sample_resultset):
    """Process a single job structure in the job_data.txt file"""
    job_data = copy.deepcopy(sample_data.job_data[:1])
    job = job_data[0]['job']
    job_data[0]['revision_hash'] = sample_resultset[0]['revision_hash']

    jm.store_result_set_data(sample_resultset)

    # complete version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry
    job['job_guid'] = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)

    jl = jm.get_job_list(0, 10)

    jm.disconnect()
    refdata.disconnect()

    assert len(jl) == 1
    assert jl[0]['result'] == 'retry'


def test_cycle_all_data(jm, refdata, sample_data, initial_data,
                        sample_resultset, mock_log_parser):
    """
    Test cycling the sample data
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset, False)

    time_now = time.time()
    cycle_date_ts = time_now - 7 * 24 * 3600

    jm.execute(
        proc="jobs_test.updates.set_result_sets_push_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_jobs_for_cycling",
        placeholders=[time_now - 24 * 3600]
    )

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")

    call_command('cycle_data', sleep_time=0, cycle_interval=1)

    jobs_after = jm.execute(proc="jobs_test.selects.jobs")

    assert len(jobs_after) == len(jobs_before) - len(jobs_to_be_deleted)

    # There should be no jobs after cycling
    assert len(jobs_after) == 0


def test_cycle_one_job(jm, refdata, sample_data, initial_data,
                       sample_resultset, mock_log_parser):
    """
    Test cycling one job in a group of jobs to confirm there are no
    unexpected deletions
    """

    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset, False)

    time_now = time.time()
    cycle_date_ts = int(time_now - 7 * 24 * 3600)

    jm.execute(
        proc="jobs_test.updates.set_result_sets_push_timestamp",
        placeholders=[time_now]
    )

    jm.execute(
        proc="jobs_test.updates.set_one_result_set_push_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_result_set_jobs",
        placeholders=[1]
    )

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")

    call_command('cycle_data', sleep_time=0, cycle_interval=1, debug=True)

    jobs_after = jm.execute(proc="jobs_test.selects.jobs")

    # Confirm that the target result set has no jobs in the
    # jobs table
    jobs_to_be_deleted_after = jm.execute(
        proc="jobs_test.selects.get_result_set_jobs",
        placeholders=[1]
    )

    assert len(jobs_to_be_deleted_after) == 0

    assert len(jobs_after) == len(jobs_before) - len(jobs_to_be_deleted)


def test_cycle_all_data_in_chunks(jm, refdata, sample_data, initial_data,
                                  sample_resultset, mock_log_parser):
    """
    Test cycling the sample data in chunks.
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset, False)

    # build a date that will cause the data to be cycled
    time_now = time.time()
    cycle_date_ts = int(time_now - 7 * 24 * 3600)

    jm.execute(
        proc="jobs_test.updates.set_result_sets_push_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.execute(
        proc="jobs_test.selects.get_jobs_for_cycling",
        placeholders=[time_now - 24 * 3600]
    )

    jobs_before = jm.execute(proc="jobs_test.selects.jobs")

    call_command('cycle_data', sleep_time=0, cycle_interval=1, chunk_size=3)

    jobs_after = jm.execute(proc="jobs_test.selects.jobs")

    assert len(jobs_after) == len(jobs_before) - len(jobs_to_be_deleted)

    # There should be no jobs after cycling
    assert len(jobs_after) == 0


def test_bad_date_value_ingestion(jm, initial_data, mock_log_parser):
    """
    Test ingesting an blob with bad date value

    """
    rs = result_set()
    blob = job_data(start_timestamp="foo",
                    revision_hash=rs['revision_hash'])

    jm.store_result_set_data([rs])
    jm.store_job_data([blob])
    # if no exception, we are good.


def test_store_result_set_data(jm, initial_data, sample_resultset):

    data = jm.store_result_set_data(sample_resultset)

    result_set_ids = jm.get_dhub().execute(
        proc="jobs_test.selects.result_set_ids",
        key_column='revision_hash',
        return_type='dict'
    )
    revision_ids = jm.get_dhub().execute(
        proc="jobs_test.selects.revision_ids",
        key_column='revision',
        return_type='dict'
    )

    revision_hashes = set()
    revisions = set()

    for datum in sample_resultset:
        revision_hashes.add(datum['revision_hash'])
        for revision in datum['revisions']:
            revisions.add(revision['revision'])

    jm.disconnect()

    # Confirm all of the revision_hashes and revisions in the
    # sample_resultset have been stored
    assert set(data['result_set_ids'].keys()) == revision_hashes
    assert set(data['revision_ids'].keys()) == revisions

    # Confirm the data structures returned match what's stored in
    # the database
    print '<><>EXP'
    print data['result_set_ids']
    print '<><>ACT'
    print result_set_ids

    assert data['result_set_ids'] == result_set_ids
    assert data['revision_ids'] == revision_ids


def test_get_job_data(jm, test_project, refdata, sample_data, initial_data,
                      mock_log_parser, sample_resultset):

    target_len = 10
    job_data = sample_data.job_data[:target_len]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    with ArtifactsModel(test_project) as artifacts_model:
        job_data = artifacts_model.get_job_signatures_from_ids(range(1, 11))

    assert len(job_data) is target_len


def test_store_performance_series(jm, test_project):

    # basic case: everything works as expected
    jm.store_performance_series(FakePerfData.TIME_INTERVAL,
                                FakePerfData.SERIES_TYPE,
                                FakePerfData.SIGNATURE,
                                FakePerfData.SERIES)
    stored_series = jm.get_dhub().execute(
        proc="jobs.selects.get_performance_series",
        placeholders=[FakePerfData.TIME_INTERVAL, FakePerfData.SIGNATURE])
    blob = json.loads(zlib.decompress(stored_series[0]['blob']))
    assert len(blob) == 1
    assert blob[0] == FakePerfData.SERIES[0]

    jm.disconnect()


def test_store_duplicate_performance_series(jm, test_project):
    # if we store the same data twice, we should only have
    # one entry in the series
    for i in [0, 1, 1]:
        # because of the internals of store_performance_series, we
        # need to store two *different* duplicates after the initial
        # duplicate to test the de-duplication code (this test should still
        # be valid in case that ever changes)
        series_copy = copy.deepcopy(FakePerfData.SERIES)
        series_copy[0]['result_set_id'] += i
        jm.store_performance_series(FakePerfData.TIME_INTERVAL,
                                    FakePerfData.SERIES_TYPE,
                                    FakePerfData.SIGNATURE,
                                    series_copy)
    stored_series = jm.get_dhub().execute(
        proc="jobs.selects.get_performance_series",
        placeholders=[FakePerfData.TIME_INTERVAL, FakePerfData.SIGNATURE])
    blob = json.loads(zlib.decompress(stored_series[0]['blob']))
    assert len(blob) == 2
    assert blob[0] == FakePerfData.SERIES[0]

    jm.disconnect()


def test_store_performance_series_timeout_recover(jm, test_project):
    # timeout case 1: a lock is on our series, but it will expire

    # use a thread to simulate locking and then unlocking the table
    # FIXME: this is rather fragile and depends on the thread being
    # run more or less immediately so that the lock is engaged
    def _lock_unlock():
        with JobsModel(test_project) as jm2:
            jm2.get_dhub().execute(
                proc='generic.locks.get_lock',
                placeholders=[FakePerfData.get_fake_lock_string()])
            time.sleep(1)
            jm2.get_dhub().execute(
                proc='generic.locks.release_lock',
                placeholders=[FakePerfData.get_fake_lock_string()])
    t = threading.Thread(target=_lock_unlock)
    t.start()

    # will fail at first due to lock, but we should recover and insert
    jm.store_performance_series(FakePerfData.TIME_INTERVAL,
                                FakePerfData.SERIES_TYPE,
                                FakePerfData.SIGNATURE,
                                FakePerfData.SERIES)
    t.join()
    stored_series = jm.get_dhub().execute(
        proc="jobs.selects.get_performance_series",
        placeholders=[FakePerfData.TIME_INTERVAL, FakePerfData.SIGNATURE])

    blob = json.loads(zlib.decompress(stored_series[0]['blob']))
    assert len(blob) == 1
    assert blob[0] == FakePerfData.SERIES[0]

    jm.disconnect()


def test_store_performance_series_timeout_fail(jm, test_project):
    # timeout case 2: a lock is on our series, but it will not expire in time

    jm.get_dhub().execute(
        proc='generic.locks.get_lock',
        placeholders=[FakePerfData.get_fake_lock_string()])
    old_timeout = settings.PERFHERDER_UPDATE_SERIES_LOCK_TIMEOUT
    settings.PERFHERDER_UPDATE_SERIES_LOCK_TIMEOUT = 1
    # this should fail -- we'll timeout before we're able to insert
    jm.store_performance_series(FakePerfData.TIME_INTERVAL,
                                FakePerfData.SERIES_TYPE,
                                FakePerfData.SIGNATURE,
                                FakePerfData.SERIES)
    stored_series = jm.get_dhub().execute(
        proc="jobs.selects.get_performance_series",
        placeholders=[FakePerfData.TIME_INTERVAL, FakePerfData.SIGNATURE])
    assert not stored_series

    settings.PERFHERDER_UPDATE_SERIES_LOCK_TIMEOUT = old_timeout
    jm.disconnect()


def test_remove_existing_jobs_single_existing(jm, sample_data, initial_data, refdata,
                                              mock_log_parser, sample_resultset):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    jl = jm.get_job_list(0, 10)

    data = jm._remove_existing_jobs(job_data)
    assert len(data) == 0
    jl = jm.get_job_list(0, 10)
    assert len(jl) == 1


def test_remove_existing_jobs_one_existing_one_new(jm, sample_data, initial_data, refdata,
                                                   mock_log_parser, sample_resultset):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    data = jm._remove_existing_jobs(sample_data.job_data[:2])

    assert len(data) == 1


def test_ingesting_skip_existing(jm, sample_data, initial_data, refdata,
                                 mock_log_parser, sample_resultset):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    jm.store_job_data(sample_data.job_data[:2])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 2


def test_ingest_job_with_updated_job_group(jm, refdata, sample_data, initial_data,
                                           mock_log_parser, result_set_stored):
    """
    When a job_type is associated with a job group on data ingestion,
    that association will not updated ingesting a new job with the same
    job_type but different job_group
    """
    first_job = sample_data.job_data[0]
    first_job["job"]["group_name"] = "first group name"
    first_job["job"]["group_symbol"] = "1"
    first_job["revision_hash"] = result_set_stored[0]["revision_hash"]
    jm.store_job_data([first_job])

    second_job = copy.deepcopy(first_job)
    # create a new guid to ingest the job again
    second_job_guid = "a-unique-job-guid"
    second_job["job"]["job_guid"] = second_job_guid
    second_job["job"]["group_name"] = "second group name"
    second_job["job"]["group_symbol"] = "2"
    second_job["revision_hash"] = result_set_stored[0]["revision_hash"]

    jm.store_job_data([second_job])

    second_job_lookup = jm.get_job_ids_by_guid([second_job_guid])
    second_job_stored = jm.get_job(second_job_lookup[second_job_guid]["id"])

    first_job_group_name = first_job["job"]["group_name"]

    second_job_group_name = second_job_stored[0]["job_group_name"]

    assert first_job_group_name == second_job_group_name


def test_retry_on_operational_failure(jm, initial_data, monkeypatch):
    """Test that we retry 20 times on operational failures"""
    from _mysql_exceptions import OperationalError
    from treeherder.model import utils
    from datasource.bases.SQLHub import SQLHub

    orig_retry_execute = utils.retry_execute
    retry_count = {'num': 0}

    def retry_execute_mock(dhub, logger, retries=0, **kwargs):
        retry_count['num'] = retries

        # if it goes beyond 20, we may be in an infinite retry loop
        assert retries <= 20
        return orig_retry_execute(dhub, logger, retries, **kwargs)

    monkeypatch.setattr(utils, "retry_execute", retry_execute_mock)

    def execute_mock(*args, **kwargs):
        raise OperationalError("got exception")

    monkeypatch.setattr(SQLHub, "execute", execute_mock)

    try:
        jm.get_job_list(0, 10)
    except OperationalError:
        assert True

    assert retry_count['num'] == 20
