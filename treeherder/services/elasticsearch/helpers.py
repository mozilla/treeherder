import logging

from elasticsearch import TransportError
from elasticsearch.helpers import bulk as es_bulk

from treeherder.utils.itertools import compact

from .connection import es_conn
from .mapping import (DOC_TYPE,
                      INDEX_NAME,
                      INDEX_SETTINGS)
from .utils import (dict_to_op,
                    to_dict)

logger = logging.getLogger(__name__)


def all_documents(index=INDEX_NAME):
    """
    Get all documents from the given index.

    Returns full Elasticsearch objects so you can get metadata too.
    """
    query = {
        'query': {
            'match_all': {}
        }
    }
    for result in raw_query(query, index=index):
        yield result


def bulk(iterable, index=INDEX_NAME, doc_type=DOC_TYPE, action='index'):
    """
    Wrapper of elasticsearch's bulk method

    Converts an interable of models to document operations and submits them to
    Elasticsearch.  Returns a count of operations when done.

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.Elasticsearch.bulk
    https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
    """
    actions = compact(dict_to_op(
        to_dict(model),
        index_name=INDEX_NAME,
        doc_type=DOC_TYPE,
        op_type=action,
    ) for model in iterable)

    # fail fast if there are no actions
    if not actions:
        return 0

    items, _ = es_bulk(es_conn, actions, doc_type=doc_type, index=index)

    return items


def count_index(index=INDEX_NAME):
    """
    Return a document count for the given index.

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.Elasticsearch.count
    https://www.elastic.co/guide/en/elasticsearch/reference/current/search-count.html
    """
    refresh_index()  # Refresh the index so we can get a correct count

    query = {
        'query': {
            'match_all': {}
        }
    }
    result = es_conn.count(index=index, doc_type=DOC_TYPE, body=query)
    return result['count']


def get_document(id, index=INDEX_NAME, doc_type=DOC_TYPE, **kwargs):
    """
    Thin wrapper to get a single document by ID.

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.Elasticsearch.get
    https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html
    """
    result = es_conn.get(index=index, doc_type=doc_type, id=id, **kwargs)
    return result['_source']


def index(obj, index=INDEX_NAME, doc_type=DOC_TYPE):
    """
    Index the given document.

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.Elasticsearch.index
    https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html
    """
    doc = to_dict(obj)

    if doc is None:
        return

    id = doc.pop('id')

    return es_conn.index(index, doc_type, doc, id=id)


def raw_query(query, index=INDEX_NAME, doc_type=DOC_TYPE):
    """
    Thin wrapper of the search function to provide useful defaults

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.Elasticsearch.search
    http://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html
    """
    result = es_conn.search(index=index, doc_type=DOC_TYPE, body=query)
    return result['hits']['hits']


def refresh_index(index=INDEX_NAME):
    """
    Simple wrapper to refresh a given index.

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.client.IndicesClient.refresh
    https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-refresh.html
    """
    logger.info('Refreshing all es indices')
    es_conn.indices.refresh(INDEX_NAME)


def reinit_index(index=INDEX_NAME):
    """
    Delete and then initialise the given index name

    Gets settings if they exist in the mappings module.

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.client.IndicesClient.create
    https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-create-index.html

    https://elasticsearch-py.readthedocs.io/en/master/api.html#elasticsearch.client.IndicesClient.delete
    https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-delete-index.html
    """
    es_conn.indices.delete(index, ignore=404)

    try:
        es_conn.indices.create(index, INDEX_SETTINGS.get(index, None))
    except TransportError as e:
        raise Exception('Failed to created index, got: {}'.format(e.error))


def search(query, index=INDEX_NAME, doc_type=DOC_TYPE):
    """
    Thin wrapper of the main query function to provide just the resulting objects
    """
    results = raw_query(query, index=index, doc_type=doc_type)
    return [r['_source'] for r in results]
