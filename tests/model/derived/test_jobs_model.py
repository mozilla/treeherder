import time
import os
import json
import pytest
import itertools

from treeherder.model.derived.base import DatasetNotFoundError
from tests.sample_data_generator import job_data, result_set
from tests.sampledata import SampleData
from tests import test_utils
from datadiff import diff

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
    assert data['result_set_ids'] == result_set_ids
    assert data['revision_ids'] == revision_ids

def test_store_performance_artifact(jm, refdata, sample_data, initial_data,
                                  mock_log_parser, sample_resultset):

    talos_perf_data = SampleData.get_talos_perf_data()

    job_data = sample_data.job_data[:20]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset, False)

    job_ids = range(1,21)
    jm.store_performance_artifact(job_ids, talos_perf_data)