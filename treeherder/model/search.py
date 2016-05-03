from functools import wraps

from django.conf import settings
from elasticsearch.helpers import bulk
from elasticsearch_dsl import (Boolean,
                               DocType,
                               Integer,
                               String,
                               analyzer,
                               tokenizer)
from elasticsearch_dsl.connections import connections

connection = None

message_tokenizer = tokenizer('message', 'pattern',
                              pattern=r"0x[0-9a-fA-F]+|[\W0-9]+?")

message_analyzer = analyzer('message_analyzer',
                            tokenizer=message_tokenizer,
                            filters=[])


class TestFailureLine(DocType):
    job_guid = String(required=True, index='not_analyzed')
    test = String(required=True, index='not_analyzed')
    subtest = String(required=True, index='not_analyzed')
    status = String(required=True, index='not_analyzed')
    expected = String(required=True, index='not_analyzed')
    best_classification = Integer(index='not_analyzed')
    best_is_verified = Boolean(index='not_analyzed')
    message = String(analyzer=message_analyzer)

    class Meta(object):
        index = 'test_failure_line'

    @classmethod
    def from_model(cls, line):
        if line.action == "test_result":
            rv = cls(job_guid=line.job_guid,
                     test=line.test,
                     subtest=line.subtest,
                     status=line.status,
                     expected=line.expected,
                     message=line.message,
                     best_classification=(line.best_classification.id
                                          if line.best_classification else None),
                     best_is_verified=line.best_is_verified)
            rv.meta.id = line.id
            return rv


def es_connected(default=None):
    def decorator(func):
        @wraps(func)
        def inner(*args, **kwargs):
            if connection is None:
                return default
            return func(*args, **kwargs)
        return inner
    return decorator


@es_connected()
def bulk_insert(items):
    bulk_data = []
    for item in items:
        bulk_data.append(item.to_dict(include_meta=True))

    return bulk(connection, bulk_data)


@es_connected()
def bulk_delete(cls, ids):
    actions = []
    for id in ids:
        actions.append({
            '_op_type': 'delete',
            '_index': cls._doc_type.index,
            '_type': cls._doc_type.name,
            '_id': id})
    bulk(connection, actions)


@es_connected()
def refresh_all():
    return connection.indices.refresh()


def doctypes():
    return [item for item in globals().values()
            if type(item) == type(DocType) and
            issubclass(item, DocType) and item != DocType]


def _init():
    global connection

    if settings.ELASTIC_SEARCH["url"]:
        connection = connections.create_connection(
            hosts=[settings.ELASTIC_SEARCH["url"]],
            use_ssl=settings.ELASTIC_SEARCH["use_ssl"],
            timeout=20)
    else:
        return

    # Create any indices that are missing
    indices = connection.indices.get("*")
    for item in doctypes():
        if item._doc_type.index not in indices:
            item.init()


_init()
