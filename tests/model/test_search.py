from treeherder.model import search


def test_store_none_subtest(elasticsearch):
    doc = search.TestFailureLine(job_guid="1234",
                                 test="test",
                                 subtest=None,
                                 status="FAIL",
                                 expected="PASS",
                                 message="Example")
    doc.save()
    assert doc.subtest is None
    search.refresh_all()

    docs = search.TestFailureLine.search().execute()
    assert len(docs) == 1
    assert docs[0].subtest == ""


def test_store_no_subtest(elasticsearch):
    doc = search.TestFailureLine(job_guid="1234",
                                 test="test",
                                 status="FAIL",
                                 expected="PASS",
                                 message="Example")
    doc.save()
    assert doc.subtest == ""
    search.refresh_all()

    docs = search.TestFailureLine.search().execute()
    assert len(docs) == 1
    assert docs[0].subtest == ""
