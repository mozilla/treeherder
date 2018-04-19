from pyelasticsearch.exceptions import (ElasticHttpError,
                                        ElasticHttpNotFoundError)

from .connection import es_conn
from .mapping import (DOC_TYPE,
                      INDEX_NAME,
                      INDEX_SETTINGS)
from .utils import (dict_to_op,
                    to_dict)


def all_documents(index=INDEX_NAME):
    return all_hits(index)['hits']


def all_hits(index):
    """
    Get all documents by matching the equivalent of "*"

    Returns the raw search response so callers can either use the documents,
    the count, or both.
    """
    query = {
        'query': {
            'match_all': {}
        }
    }
    return es_conn.search(query, index=index)['hits']


def bulk(iterable, name=INDEX_NAME, doc_type=DOC_TYPE, action='index'):
    """
    Wrapper of pyelasticsearch's bulk method

    Converts an interable of models to document operations and returns a count
    of documents in the index when done.

    https://pyelasticsearch.readthedocs.io/en/latest/api/#pyelasticsearch.ElasticSearch.bulk
    https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
    """
    actions = (dict_to_op(to_dict(model), op_type=action) for model in iterable)
    actions = [x for x in actions if x]  # to_doc can return Nones currently

    # fail fast if there are no actions
    if not actions:
        return 0

    result = es_conn.bulk(actions, doc_type=doc_type, index=name)

    return len(result['items'])


def count_index(name=INDEX_NAME):
    """
    Return a document count for the given index.

    https://pyelasticsearch.readthedocs.io/en/latest/api/#pyelasticsearch.ElasticSearch.count
    https://www.elastic.co/guide/en/elasticsearch/reference/current/search-count.html
    """
    refresh_index()  # Refresh the index so we can get a correct count
    return all_hits(name)['total']


def get(id, index=INDEX_NAME, doc_type=DOC_TYPE, **kwargs):
    """
    Thin wrapper to get a single document by ID.

    https://pyelasticsearch.readthedocs.io/en/latest/api/#pyelasticsearch.ElasticSearch.get
    https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html
    """
    result = es_conn.get(index=index, doc_type=doc_type, id=id, **kwargs)
    return result['_source']


def index(obj, index=INDEX_NAME, doc_type=DOC_TYPE):
    """
    Index the given document.

    https://pyelasticsearch.readthedocs.io/en/latest/api/#pyelasticsearch.ElasticSearch.index
    https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-index_.html
    """
    doc = to_dict(obj)
    return es_conn.index(index, doc_type, doc, id=obj.id)


def refresh_index(name=INDEX_NAME):
    """
    Simple wrapper to refresh a given index.

    https://pyelasticsearch.readthedocs.io/en/latest/api/#pyelasticsearch.ElasticSearch.refresh
    https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-refresh.html
    """
    es_conn.refresh(INDEX_NAME)


def reinit_index(name=INDEX_NAME):
    """
    Delete and then initialise the given index name

    Gets settings if they exist in the mappings module.

    https://pyelasticsearch.readthedocs.io/en/latest/api/#pyelasticsearch.ElasticSearch.create_index
    https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-create-index.html

    https://pyelasticsearch.readthedocs.io/en/latest/api/#pyelasticsearch.ElasticSearch.delete_index
    https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-delete-index.html
    """
    try:
        es_conn.delete_index(name)
    except ElasticHttpNotFoundError:
        pass

    try:
        es_conn.create_index(name, INDEX_SETTINGS.get(name, None))
    except ElasticHttpError as e:
        raise Exception('Failed to created index, got: {}'.format(e.error))
