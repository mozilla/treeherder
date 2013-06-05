import json
import pytest
from treeherder.model.derived.base import DatasetNotFoundError
from tests.sample_data_generator import job_data
from tests import test_utils

slow = pytest.mark.slow


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


def test_ingest_single_sample_job(jm, sample_data, initial_data):
    """Process a single job structure in the job_data.txt file"""
    job_data = sample_data.job_data[:1]
    test_utils.do_job_ingestion(jm, job_data)


@slow
def test_ingest_all_sample_jobs(jm, sample_data, initial_data):
    """
    Process each job structure in the job_data.txt file and verify.

    """
    job_data = sample_data.job_data
    test_utils.do_job_ingestion(jm, job_data)


def test_artifact_log_ingestion(jm, initial_data):
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
    blob = job_data(artifact=artifact)
    jm.store_job_data(json.dumps(blob))
    job_ids = jm.process_objects(1)

    assert get_objectstore_last_error(jm) == u"N"

    job_id = job_ids[0]

    exp_job = test_utils.clean_job_blob_dict(blob["job"])
    act_job = test_utils.JobDictBuilder(jm, job_id).as_dict()
    assert exp_job == act_job, test_utils.diff_dict(exp_job, act_job)


def test_bad_date_value_ingestion(jm, initial_data):
    """
    Test ingesting an blob with bad date value

    """

    blob = job_data(start_timestamp="foo")
    jm.store_job_data(json.dumps(blob))
    job_ids = jm.process_objects(1)

    assert get_objectstore_last_error(
        jm) == u"invalid literal for long() with base 10: 'foo'"


def get_objectstore_last_error(jm):
    row_id = jm._get_last_insert_id("objectstore")

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    return row_data['error_msg']
