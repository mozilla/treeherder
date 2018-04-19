from treeherder.services.elasticsearch import (all_documents,
                                               count_index,
                                               es_conn,
                                               refresh_index)
from treeherder.services.elasticsearch.mapping import (DOC_TYPE,
                                                       INDEX_NAME)


def test_store_none_subtest(elasticsearch):
    doc = {
        'job_guid': '1234',
        'test': 'test',
        'subtest': None,
        'status': 'FAIL',
        'expected': 'PASS',
        'message': 'Example',
    }
    es_conn.index(INDEX_NAME, DOC_TYPE, doc)

    refresh_index()

    docs = list(all_documents())
    assert count_index() == 1
    assert docs[0]['_source']['subtest'] is None


def test_store_no_subtest(elasticsearch):
    doc = {
        'job_guid': '1234',
        'test': 'test',
        'status': 'FAIL',
        'expected': 'PASS',
        'message': 'Example',
    }
    es_conn.index(INDEX_NAME, DOC_TYPE, doc)

    refresh_index()

    docs = list(all_documents())
    assert 'subtest' not in docs[0]['_source']
    assert count_index() == 1
