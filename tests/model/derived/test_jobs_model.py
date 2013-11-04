import time
import os
import json
import pytest
import itertools

from treeherder.model.derived.base import DatasetNotFoundError
from tests.sample_data_generator import job_data, result_set
from tests import test_utils
from datadiff import diff

slow = pytest.mark.slow
xfail = pytest.mark.xfail


def test_unicode(jm):
    """Unicode representation of a ``JobModel`` is the project name."""
    assert unicode(jm) == unicode(jm.project)


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


def test_ingest_single_sample_job(jm, refdata, sample_data, initial_data,
                                  mock_log_parser, sample_resultset):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)


def test_ingest_all_sample_jobs(jm, refdata, sample_data, initial_data, sample_resultset):
    """
    @@@ - Re-enable when our job_data.txt has been re-created with
          correct data.

    Process each job structure in the job_data.txt file and verify.

    """
    job_data = sample_data.job_data
    test_utils.do_job_ingestion(jm, refdata, job_data, sample_resultset)

def test_bad_date_value_ingestion(jm, initial_data):
    """
    Test ingesting an blob with bad date value

    """
    rs = result_set()
    blob = job_data(start_timestamp="foo",
                    revision_hash=rs['revision_hash'])

    jm.store_job_data(json.dumps(blob), blob['job']['job_guid'])

    jm.store_result_set_data([rs])

    jm.process_objects(1)

    # Confirm that we don't get a ValueError when casting a non-number
    last_error = get_objectstore_last_error(
        jm) == u"invalid literal for long() with base 10: 'foo'"

    assert last_error == False

def get_objectstore_last_error(jm):
    row_id = jm._get_last_insert_id("objectstore")

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

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

    # Confirm all of the revision_hashes and revisions in the
    # sample_resultset have been stored
    assert set(data['result_set_ids'].keys()) == revision_hashes
    assert set(data['revision_ids'].keys()) == revisions

    # Confirm the data structures returned match what's stored in
    # the database
    assert data['result_set_ids'] == result_set_ids
    assert data['revision_ids'] == revision_ids
