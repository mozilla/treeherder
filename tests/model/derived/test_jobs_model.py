import time
import os
import json
import pytest
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


def test_ingest_single_sample_job(jm, sample_data, initial_data,
                                  mock_log_parser, sample_resultset):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)


@slow
@xfail
def test_ingest_all_sample_jobs(jm, sample_data, initial_data, sample_resultset):
    """
    @@@ - Re-enable when our job_data.txt has been re-created with
          correct data.

    Process each job structure in the job_data.txt file and verify.

    """
    job_data = sample_data.job_data
    test_utils.do_job_ingestion(jm, job_data, sample_resultset)


def test_artifact_log_ingestion(jm, initial_data, mock_log_parser):
    """
    Test ingesting an artifact with a log

    artifact:{
        type:" json | img | ...",
        name:"",
        log_urls:[
            ]
        blob:""
    },
    """
    artifact = {
        u"type": u"json",
        u"name": u"arti-foo-ct",
        u"log_urls": [
            {
                u"url": u"http://ftp.mozilla.org/arty-facto/...",
                u"name": u"artifact_url"
            }
        ],
        u"blob": ""
    }
    rs = result_set()

    blob = job_data(artifact=artifact, revision_hash=rs['revision_hash'])
    jm.store_job_data(json.dumps(blob), blob['job']['job_guid'])

    jm.store_result_set_data(rs['revision_hash'], rs['push_timestamp'],
                             rs['revisions'])

    jm.process_objects(1)

    assert get_objectstore_last_error(jm) == u"N"

    exp_job = test_utils.clean_job_blob_dict(blob["job"])
    act_job = test_utils.JobDictBuilder(jm, blob['job']['job_guid']).as_dict()
    assert exp_job == act_job, test_utils.diff_dict(exp_job, act_job)


def test_bad_date_value_ingestion(jm, initial_data):
    """
    Test ingesting an blob with bad date value

    """
    rs = result_set()
    blob = job_data(start_timestamp="foo",
                    revision_hash=rs['revision_hash'])

    jm.store_job_data(json.dumps(blob), blob['job']['job_guid'])

    jm.store_result_set_data(rs['revision_hash'], rs['push_timestamp'],
                             rs['revisions'])

    jm.process_objects(1)

    assert get_objectstore_last_error(
        jm) == u"invalid literal for long() with base 10: 'foo'"


def get_objectstore_last_error(jm):
    row_id = jm._get_last_insert_id("objectstore")

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    return row_data['error_msg']


def test_set_revision(jm, initial_data, revision_params):
    """
    tests that a single revision is created
    by get_or_create_revision
    """


    row_id = jm._get_or_create_revision(revision_params)
    row_data = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.revisions", )

    assert len(row_data) == 1

    exp = {
        "author": "Mauro Doglio - <mdoglio@mozilla.com>",
        "commit_timestamp": 1365732271, # this is nullable
        "comments": "Bug 854583 - Use _pointer_ instead of...",
        "revision": "c91ee0e8a980",
        "files": '["file1", "file2"]',
        "active_status": "active",
        "id": row_id,
        "repository_id": 3

    }
    assert row_data[0] == exp, diff(row_data[0], exp)


def test_set_result_set(jm, initial_data):
    """
    Tests that _get_or_create_result_set stores
    the correct info.
    """

    timestamp = int(time.time())
    rev_hash = "my-revision-hash"
    result_set_id = jm._get_or_create_result_set(rev_hash,
                                                 timestamp)
    row_data = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.resultset_by_rev_hash",
        placeholders=[rev_hash]
    )

    exp = {
        "id": 1,
        "revision_hash": rev_hash,
        "push_timestamp": timestamp,
        "active_status": "active"
    }

    assert row_data[0] == exp, diff(row_data[0], exp)


def test_set_revision_map(jm, initial_data, revision_params):
    """
    Tests that _get_or_create_revision_map stores
    the correct info.
    """

    row_id = jm._get_or_create_revision(revision_params)

    timestamp = int(time.time())
    rev_hash = "my-revision-hash"
    result_set_id = jm._get_or_create_result_set(rev_hash,
                                                 timestamp)
    revision_map_id = jm._get_or_create_revision_map(1, result_set_id)
    row_data = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.revision_map",
    )

    exp = {
        "id": revision_map_id,
        "revision_id": 1,
        "result_set_id": 1,
        "active_status": "active"
    }

    assert row_data[0] == exp, diff(row_data[0], exp)


def test_store_result_set_data(jm, initial_data, sample_resultset):

    jm.store_result_set_data(sample_resultset['revision_hash'],
                             sample_resultset['push_timestamp'],
                             sample_resultset['revisions'])

    row_data = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.resultset_by_rev_hash",
        placeholders=[sample_resultset['revision_hash']]
    )
    exp = {
        "id": 1,
        "push_timestamp": 12345678,
        "revision_hash": "d62d628d5308f2b9ee81be755140d77f566bb400",
        "active_status": "active"
    }

    assert row_data[0] == exp, diff(row_data[0], exp)