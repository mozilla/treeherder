import json


from .sample_data_generator import job_json


def test_unicode(jm):
    """Unicode representation of a ``JobModel`` is the project name."""
    assert unicode(jm) == unicode(jm.project)


def test_claim_objects(jm, sample_data):
    """``claim_objects`` claims & returns unclaimed rows up to a limit."""

    blobs = [json.dumps(job) for job in sample_data.job_data[:3]]
    for blob in blobs:
        jm.store_job_data(blob)

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
    assert set([r["json_blob"] for r in rows1 + rows2]) == set(blobs)

    # the blobs are all marked as "loading" in the database
    assert loading_rows == 3


def test_mark_object_complete(jm):
    """Marks claimed row complete and records run id."""
    jm.store_job_data(job_json())
    row_id = jm.claim_objects(1)[0]["id"]
    job_id = 7  # any arbitrary number; no cross-db constraint checks

    jm.mark_object_complete(row_id, job_id)

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    assert row_data["job_id"] == job_id
    assert row_data["processed_state"] == "complete"


def test_process_objects(jm):
    """Claims and processes a chunk of unprocessed JSON jobs data blobs."""
    # Load some rows into the objectstore
    blobs = [
        job_json(submit_timestamp="1330454755"),
        job_json(submit_timestamp="1330454756"),
        job_json(submit_timestamp="1330454757"),
    ]

    for blob in blobs:
        jm.store_job_data(blob)

    # just process two rows
    jm.process_objects(2)

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


def test_process_objects_invalid_json(jm):
    """process_objects fail for invalid json"""
    jm.store_job_data("invalid json")
    row_id = jm._get_last_insert_id("objectstore")

    jm.process_objects(1)

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    expected_error = "Malformed JSON: No JSON object could be decoded"

    assert row_data['error'] == 'Y'
    assert row_data['error_msg'] == expected_error
    assert row_data['processed_state'] == 'ready'


def test_process_objects_unknown_error(jm, monkeypatch):
    """process_objects fail for unknown reason"""
    jm.store_job_data("{}")
    row_id = jm._get_last_insert_id("objectstore")

    # force an unexpected error to occur
    def raise_error(*args, **kwargs):
        raise ValueError("Something blew up!")
    monkeypatch.setattr(jm, "load_job_data", raise_error)

    jm.process_objects(1)

    row_data = jm.get_dhub(jm.CT_OBJECTSTORE).execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    expected_error_msg = "Unknown error: ValueError: Something blew up!"

    assert row_data['error'] == 'Y'
    assert row_data['error_msg'] == expected_error_msg
    assert row_data['processed_state'] == 'ready'


def test_ingest_sample_data(jm, sample_data):
    """Process all job structures in the job_data.txt file"""
    job_data = sample_data.job_data[:250]
    for blob in job_data:
        jm.store_job_data(json.dumps(blob))

    data_length = len(job_data)

    # process 10 rows at a time
    remaining = data_length
    while remaining:
        jm.process_objects(10)
        remaining -= 10

    job_rows = jm.get_jobs_dhub().execute(
        proc="jobs_test.selects.jobs")

    complete_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.complete")[0]["complete_count"]
    loading_count = jm.get_os_dhub().execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert complete_count == data_length
    assert loading_count == 0
    assert len(job_rows) == data_length
