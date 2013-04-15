import pytest
import json

from datazilla.model.base import TestDataError, TestData

from ..sample_data import job_json, job_data, ref_data_json


def test_unicode(ptm):
    """Unicode representation of a ``PerformanceTestModel`` is the project name."""
    assert unicode(ptm) == unicode(ptm.project)


def test_disconnect(ptm):
    """test that your model disconnects"""

    # establish the connection to perftest.
    ptm._get_last_insert_id()
    # establish the connection to objectstore
    ptm.retrieve_test_data(limit=1)

    ptm.disconnect()
    for src in ptm.sources.itervalues():
        assert src.dhub.connection["master_host"]["con_obj"].open == False


def test_claim_objects(ptm):
    """``claim_objects`` claims & returns unclaimed rows up to a limit."""
    blobs = [
        perftest_json(testrun={"date": "1330454755"}),
        perftest_json(testrun={"date": "1330454756"}),
        perftest_json(testrun={"date": "1330454757"}),
        ]

    for blob in blobs:
        ptm.store_test_data(blob)

    rows1 = ptm.claim_objects(2)

    # a separate worker with a separate connection
    from datazilla.model import PerformanceTestModel
    dm2 = PerformanceTestModel(ptm.project)

    rows2 = dm2.claim_objects(2)

    loading_rows = ptm.sources["objectstore"].dhub.execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert len(rows1) == 2
    # second worker asked for two rows but only got one that was left
    assert len(rows2) == 1

    # all three blobs were fetched by one of the workers
    assert set([r["json_blob"] for r in rows1 + rows2]) == set(blobs)

    # the blobs are all marked as "loading" in the database
    assert loading_rows == 3


def test_mark_object_complete(ptm):
    """Marks claimed row complete and records run id."""
    ptm.store_test_data(perftest_json())
    row_id = ptm.claim_objects(1)[0]["id"]
    test_run_id = 7 # any arbitrary number; no cross-db constraint checks

    ptm.mark_object_complete(row_id, test_run_id)

    row_data = ptm.sources["objectstore"].dhub.execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    assert row_data["test_run_id"] == test_run_id
    assert row_data["processed_flag"] == "complete"


def test_process_objects(ptm):
    """Claims and processes a chunk of unprocessed JSON test data blobs."""
    # Load some rows into the objectstore
    blobs = [
        perftest_json(testrun={"date": "1330454755"}),
        perftest_json(testrun={"date": "1330454756"}),
        perftest_json(testrun={"date": "1330454757"}),
        ]

    for blob in blobs:
        ptm.store_test_data(blob)

    # just process two rows
    ptm.process_objects(2)

    test_run_rows = ptm.sources["perftest"].dhub.execute(
        proc="perftest_test.selects.test_runs")
    date_set = set([r['date_run'] for r in test_run_rows])
    expected_dates = set([1330454755, 1330454756, 1330454757])

    complete_count = ptm.sources["objectstore"].dhub.execute(
        proc="objectstore_test.counts.complete")[0]["complete_count"]
    loading_count = ptm.sources["objectstore"].dhub.execute(
        proc="objectstore_test.counts.loading")[0]["loading_count"]

    assert complete_count == 2
    assert loading_count == 0
    assert date_set.issubset(expected_dates)
    assert len(date_set) == 2


def test_process_objects_invalid_json(ptm):
    ptm.store_test_data("invalid json")
    row_id = ptm._get_last_insert_id("objectstore")

    ptm.process_objects(1)

    row_data = ptm.sources["objectstore"].dhub.execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    expected_error = "Malformed JSON: No JSON object could be decoded"

    assert row_data['error_flag'] == 'Y'
    assert row_data['error_msg'] == expected_error
    assert row_data['processed_flag'] == 'ready'


def test_process_objects_unknown_error(ptm, monkeypatch):
    ptm.store_test_data("{}")
    row_id = ptm._get_last_insert_id("objectstore")

    # force an unexpected error to occur
    def raise_error(*args, **kwargs):
        raise ValueError("Something blew up!")
    monkeypatch.setattr(ptm, "load_test_data", raise_error)

    ptm.process_objects(1)

    row_data = ptm.sources["objectstore"].dhub.execute(
        proc="objectstore_test.selects.row", placeholders=[row_id])[0]

    expected_error_msg = "Unknown error: ValueError: Something blew up!"

    assert row_data['error_flag'] == 'Y'
    assert row_data['error_msg'] == expected_error_msg
    assert row_data['processed_flag'] == 'ready'


