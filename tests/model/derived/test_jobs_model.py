import time
import json
import pytest
import itertools
import pprint
import copy

from treeherder.model.derived.base import DatasetNotFoundError
from tests.sample_data_generator import job_data, result_set
from tests.sampledata import SampleData
from tests import test_utils

slow = pytest.mark.slow
xfail = pytest.mark.xfail


def test_unicode(jm):
    """Unicode representation of a ``JobModel`` is the project name."""
    assert unicode(jm) == unicode(jm.project)

    jm.disconnect()


def test_disconnect(jm):
    """test that your model disconnects"""

    # establish the connection to jobs.
    jm._get_last_insert_id()
    # establish the connection to objectstore
    jm.retrieve_job_data(limit=1)

    jm.disconnect()
    assert not jm.get_os_dhub().connection["master_host"]["con_obj"].open
    assert not jm.get_jobs_dhub().connection["master_host"]["con_obj"].open


def test_bad_contenttype(jm):
    """Test trying to get an invalid contenttype"""
    with pytest.raises(DatasetNotFoundError):
        jm.get_dhub("foo")

    jm.disconnect()


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
    new_id_set = set( range(1, len(sample_slice) + 1) )

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
    jm.load_job_data(job_data)

    jl = jm.get_job_list(0, 1)
    initial_job_id = jl[0]["id"]


    # now we simulate the complete version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry from objectstore
    job['job_guid'] = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)
    jm.process_objects(10, raise_errors=True)

    jl = jm.get_job_list(0, 10)
    print json.dumps(jl, indent=4)

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
    jm.load_job_data(job_data)

    jl = jm.get_job_list(0, 1)
    initial_job_id = jl[0]["id"]

    # now we simulate the complete RETRY version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'retry'
    # convert the job_guid to what it would be on a retry from objectstore
    job['job_guid'] = job_guid_root + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)
    jm.process_objects(10, raise_errors=True)


    # now we simulate the complete SUCCESS version of the job coming in
    job['state'] = 'completed'
    job['result'] = 'success'
    # convert the job_guid to the normal root style
    job['job_guid'] = job_guid_root

    jm.store_job_data(job_data)
    jm.process_objects(10, raise_errors=True)


    jl = jm.get_job_list(0, 10)
    print json.dumps(jl, indent=4)

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
    # convert the job_guid to what it would be on a retry from objectstore
    job['job_guid'] = job['job_guid'] + "_" + str(job['end_timestamp'])[-5:]

    jm.store_job_data(job_data)
    jm.process_objects(10, raise_errors=True)

    jl = jm.get_job_list(0, 10)
    print json.dumps(jl, indent=4)

    jm.disconnect()
    refdata.disconnect()

    assert len(jl) == 1
    assert jl[0]['result'] == 'retry'


def test_cycle_all_data(jm, refdata, sample_data, initial_data, sample_resultset, mock_log_parser):
    """
    Test cycling the sample data
    """
    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset, False)

    # build a date that will cause the data to be cycled
    cycle_date_ts = int(time.time() - (jm.DATA_CYCLE_INTERVAL + 100000))

    jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.updates.set_result_sets_push_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.get_jobs_for_cycling",
        placeholders=[cycle_date_ts]
    )

    job_count = len(jobs_to_be_deleted)

    jobs_before = jm.get_dhub(jm.CT_JOBS).execute(proc="jobs_test.selects.jobs")

    sql_targets = jm.cycle_data({}, False)

    jobs_after = jm.get_dhub(jm.CT_JOBS).execute(proc="jobs_test.selects.jobs")

    jm.disconnect()
    refdata.disconnect()

    assert len(jobs_before) == job_count

    # There should be no jobs after cycling
    assert len(jobs_after) == 0

    assert sql_targets['jobs.deletes.cycle_job'] == job_count

def test_cycle_one_job(jm, refdata, sample_data, initial_data, sample_resultset, mock_log_parser):
    """
    Test cycling one job in a group of jobs to confirm there are no
    unexpected deletions
    """

    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset, False)

    # set all the result_sets to a non cycle time
    non_cycle_date_ts = int(time.time() - (jm.DATA_CYCLE_INTERVAL - 100000))
    jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.updates.set_result_sets_push_timestamp",
        placeholders=[ non_cycle_date_ts ]
    )

    # build a date that will cause the data to be cycled
    cycle_date_ts = int(time.time() - (jm.DATA_CYCLE_INTERVAL + 100000))

    jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.updates.set_one_result_set_push_timestamp",
        placeholders=[cycle_date_ts]
    )

    jobs_to_be_deleted = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.get_result_set_jobs",
        placeholders=[1]
    )

    job_count = len(jobs_to_be_deleted)

    sql_targets = jm.cycle_data({}, False)

    assert sql_targets['jobs.deletes.cycle_job'] == job_count

    #Confirm that the target result set has no jobs in the
    #jobs table
    jobs_count_after_delete = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.get_result_set_jobs",
        placeholders=[1]
    )

    assert len(jobs_count_after_delete) == 0

    jm.disconnect()
    refdata.disconnect()

def test_bad_date_value_ingestion(jm, initial_data, mock_log_parser):
    """
    Test ingesting an blob with bad date value

    """
    rs = result_set()
    blob = job_data(start_timestamp="foo",
                    revision_hash=rs['revision_hash'])

    jm.store_job_data([blob])

    jm.store_result_set_data([rs])

    jm.process_objects(1)

    # Confirm that we don't get a ValueError when casting a non-number
    last_error = get_objectstore_last_error(
        jm) == u"invalid literal for long() with base 10: 'foo'"

    jm.disconnect()

    assert last_error == False

def get_objectstore_last_error(jm):
    row_id = jm._get_last_insert_id("objectstore")

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    jm.disconnect()

    return row_data['error_msg']


def test_store_result_set_data(jm, initial_data, sample_resultset):

    data = jm.store_result_set_data(sample_resultset)

    result_set_ids = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.result_set_ids",
        key_column='revision_hash',
        return_type='dict'
    )
    revision_ids = jm.get_dhub(jm.CT_JOBS).execute(
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

def test_get_job_data(jm, refdata, sample_data, initial_data,
                                  mock_log_parser, sample_resultset):

    target_len = 10
    job_data = sample_data.job_data[:target_len]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    job_data = jm.get_job_signatures_from_ids(range(1,11))

    assert len(job_data) is target_len

def test_store_performance_artifact(
    jm, refdata, sample_data, sample_resultset, initial_data,
    mock_log_parser):

    tp_data = test_utils.ingest_talos_performance_data(
        jm, refdata, sample_data, sample_resultset
        )

    job_ids = tp_data['job_ids']
    perf_data = tp_data['perf_data']

    for index, d in enumerate(perf_data):
        perf_data[index]['blob'] = json.dumps({ 'talos_data':[ d['blob'] ]})

    jm.store_performance_artifact(job_ids, perf_data)

    replace = [ ','.join( ['%s'] * len(job_ids) ) ]

    performance_artifact_signatures = jm.get_jobs_dhub().execute(
        proc="jobs.selects.get_performance_artifact",
        debug_show=jm.DEBUG,
        placeholders=job_ids,
        replace=replace,
        return_type='set',
        key_column='series_signature')

    series_signatures = jm.get_jobs_dhub().execute(
        proc="jobs.selects.get_all_series_signatures",
        return_type='set',
        key_column='signature',
        debug_show=jm.DEBUG)

    jm.disconnect()

    assert performance_artifact_signatures == series_signatures


def test_remove_existing_jobs_single_existing(jm, sample_data, initial_data, refdata,
                                     mock_log_parser, sample_resultset):
    """Remove single existing job prior to loading"""

    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

    jl = jm.get_job_list(0, 10)
    print 'JOBLIST before'
    print json.dumps(jl, indent=4)

    data = jm._remove_existing_jobs(job_data)
    # print data
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

    jm.load_job_data(sample_data.job_data[:2])

    jl = jm.get_job_list(0, 10)
    assert len(jl) == 2


def test_bug_job_map_detail(jm, eleven_jobs_processed):
    """
    test retrieving a single bug_job_map row
    """
    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = 123456

    submit_timestamp = int(time.time())
    who = "user@mozilla.com"
    try:
        jm.insert_bug_job_map(job_id, bug_id, "manual", submit_timestamp, who)

        actual = jm.get_bug_job_map_detail(job_id, bug_id)
    finally:
        jm.disconnect()

    expected = {
        "job_id": job_id,
        "bug_id": bug_id,
        "type": "manual",
        "submit_timestamp": submit_timestamp,
        "who": who}

    assert actual == expected


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
    jm.load_job_data([first_job])
    jm.process_objects(1)

    second_job = copy.deepcopy(first_job)
    # create a new guid to ingest the job again
    second_job_guid = "a-unique-job-guid"
    second_job["job"]["job_guid"] = second_job_guid
    second_job["job"]["group_name"] = "second group name"
    second_job["job"]["group_symbol"] = "2"
    second_job["revision_hash"] = result_set_stored[0]["revision_hash"]

    jm.load_job_data([second_job])
    jm.process_objects(1)

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

        #if it goes beyond 20, we may be in an infinite retry loop
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
