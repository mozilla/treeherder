import json
import pytest

from .sample_data_generator import job_data
from tests.sample_data_generator import result_set

slow = pytest.mark.slow

def test_claim_objects(jm, sample_data):
    """``claim_objects`` claims & returns unclaimed rows up to a limit."""

    blobs = []
    blob_lookup = set()
    for job in sample_data.job_data[:3]:
        blobs.append(job)
        blob_lookup.add( json.dumps(job) )

    jm.store_job_data(blobs)

    rows1 = jm.claim_objects(2)

    # a separate worker with a separate connection
    from treeherder.model.derived.jobs import JobsModel
    jm2 = JobsModel(jm.project)

    rows2 = jm2.claim_objects(2)

    loading_rows = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert len(rows1) == 2
    # second worker asked for two rows but only got one that was left
    assert len(rows2) == 1

    # all three blobs were fetched by one of the workers
    for r in rows1 + rows2:
        assert r['json_blob'] in blob_lookup


    # the blobs are all marked as "loading" in the database
    assert loading_rows == 3


def test_mark_object_complete(jm):
    """Marks claimed row complete and records run id."""
    jm.store_job_data([job_data()])
    row_id = jm.claim_objects(1)[0]["id"]

    revision_hash = "fakehash"

    object_placeholders = [
        [revision_hash, row_id]
        ]

    jm.mark_objects_complete(object_placeholders)

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    assert row_data["revision_hash"] == revision_hash
    assert row_data["processed_state"] == "complete"


def test_process_objects(jm, initial_data, mock_log_parser):
    """Claims and processes a chunk of unprocessed JSON jobs data blobs."""
    # Load some rows into the objectstore

    rs = result_set()

    blobs = [
        job_data(submit_timestamp="1330454755",
                 job_guid="guid1", revision_hash=rs['revision_hash']),
        job_data(submit_timestamp="1330454756",
                 job_guid="guid2", revision_hash=rs['revision_hash']),
        job_data(submit_timestamp="1330454757",
                 job_guid="guid3", revision_hash=rs['revision_hash']),
    ]

    jm.store_result_set_data([rs])

    jm.store_job_data(blobs)

    # just process two rows
    jm.process_objects(2, raise_errors=True)

    test_run_rows = jm.get_dhub(jm.CT_JOBS).execute(
        proc="jobs_test.selects.jobs")
    date_set = set([r['submit_timestamp'] for r in test_run_rows])
    expected_dates = set([1330454755, 1330454756, 1330454757])

    complete_count = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.counts.complete")[0]["complete_count"]
    loading_count = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert complete_count == 2
    assert loading_count == 0
    assert date_set.issubset(expected_dates)
    assert len(date_set) == 2


def test_process_objects_unknown_error(jm):
    """process_objects fail for invalid json"""
    response = jm.store_job_data(['{invalid json}'])

    exp_resp = {u'Unknown error: TypeError: string indices must be integers, not str': '{invalid json}'}

    row_id = jm._get_last_insert_id("objectstore")

    assert row_id == 0
    assert response == exp_resp

def test_ingest_sample_data(jm, sample_data, sample_resultset):
    """Process all job structures in the job_data.txt file"""

    resultset_count = len(sample_resultset)
    jm.store_result_set_data(sample_resultset)

    blobs = []
    for index, job in enumerate(sample_data.job_data[0:resultset_count]):
        job['revision_hash'] = sample_resultset[index]['revision_hash']
        blobs.append(job)

    jm.store_job_data(blobs)

    # process 10 rows at a time
    remaining = resultset_count

    jm.process_objects(resultset_count, raise_errors=True)

    job_rows = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.jobs")

    complete_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.complete")[0]["complete_count"]
    loading_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert complete_count == resultset_count
    assert loading_count == 0
    assert len(job_rows) == resultset_count


@pytest.mark.xfail
def test_objectstore_update_content(jm, sample_data):
    """
    Test updating an object of the objectstore.
    """
    original_obj = sample_data.job_data[0]
    jm.store_job_data([original_obj])

    obj_updated = original_obj.copy()
    obj_updated["job"]["state"] = "new_state"

    jm.store_job_data([obj_updated])

    stored_objs = jm.get_os_dhub().execute(
        proc="objectstore_test.selects.row_by_guid",
        placeholders=[obj_updated["job"]["job_guid"]]
    )

    # check that it didn't create a new object
    assert len(stored_objs) == 1

    stored_blob = json.loads(stored_objs[0]["json_blob"])

    # check that the blob was updated
    assert stored_blob["job"]["state"] == "new_state"
