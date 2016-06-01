import logging
from functools import wraps

import certifi
from django.conf import settings
from elasticsearch.helpers import bulk
from elasticsearch_dsl import (Boolean,
                               DocType,
                               Index,
                               Integer,
                               String,
                               analyzer,
                               tokenizer)
from elasticsearch_dsl.connections import connections

logger = logging.getLogger(__name__)

# Tokenizer that splits on tokens matching a hex number
# a decimal number, or anything non-alphanumeric.
message_tokenizer = tokenizer('message_tokenizer',
                              'pattern',
                              pattern=r"0x[0-9a-fA-F]+|[\W0-9]+?")

message_analyzer = analyzer('message_analyzer',
                            type="custom",
                            tokenizer=message_tokenizer,
                            filters=[])


class RoutedDocType(DocType):
    _routing_key = None

    @property
    def routing(self):
        return getattr(self, self._routing_key)

    @classmethod
    def get(cls, id, **kwargs):
        if "routing" not in kwargs:
            raise TypeError("Must supply 'routing' parameter to get")
        return super(RoutedDocType, cls).get(id, **kwargs)

    def save(self, **kwargs):
        if "routing" not in kwargs:
            kwargs["routing"] = self.routing
        return super(RoutedDocType, self).save(**kwargs)


def index(name):
    if settings.ELASTIC_SEARCH["index_prefix"]:
        name = "%s-%s" % (settings.ELASTIC_SEARCH["index_prefix"], name)
    return Index(name)

test_failure_line = index("test-failure-line")

test_failure_line.settings(number_of_shards=10)


@test_failure_line.doc_type
class TestFailureLine(RoutedDocType):
    """DocType representing a test with an unexpected result
    and an error message"""
    _routing_key = "test"

    job_guid = String(required=True, index='not_analyzed')
    test = String(required=True, index='not_analyzed')
    subtest = String(required=True, index='not_analyzed')
    status = String(required=True, index='not_analyzed')
    expected = String(required=True, index='not_analyzed')
    best_classification = Integer(index='not_analyzed')
    best_is_verified = Boolean(index='not_analyzed')
    message = String(analyzer=message_analyzer)

    @classmethod
    def from_model(cls, line):
        """Create a TestFailureLine object from a FailureLine model instance."""
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
    """Decorator that runs the decorated function only if we have an
    elasticsearch connection, and otherwise returns a default value.

    :param default: The default value to return in the absence of a
    decorator"""
    logged_warning = [False]

    def decorator(func):
        @wraps(func)
        def inner(*args, **kwargs):
            if connection is None:
                if not logged_warning[0]:
                    logger.warning(
                        "Tried to use elasticsearch with %s, but no connection found." %
                        func.__name__)
                    logged_warning[0] = True
                return default
            return func(*args, **kwargs)
        return inner
    return decorator


@es_connected()
def bulk_insert(items):
    """Insert multiple items into ElasticSearch.

    :param items: An iterable containing items that are
    instances of subclasses of elasticsearch_dsl.DocType"""
    bulk_data = []
    for item in items:
        data = item.to_dict(include_meta=True)
        data["_routing"] = item.routing
        bulk_data.append(data)

    return bulk(connection, bulk_data)


@es_connected()
def bulk_delete(cls, ids_routing):
    """Delete multiple items from elasticsearch by document id

    :param cls: The DocType subclass of the items being deleted.
    :param ids_routing: Iterable of (document ids, routing key) to delete."""
    actions = []
    print ids_routing
    for (id, routing) in ids_routing:
        actions.append({
            '_op_type': 'delete',
            '_index': cls._doc_type.index,
            '_type': cls._doc_type.name,
            '_id': id,
            '_routing': routing})
    bulk(connection, actions)


def refresh_all():
    """Refresh all elasticsearch indicies. This is only intended for
    test use, so that inserted documents are updated immediately and
    tests are not random"""
    if connection is None:
        logger.error("Must have an elastic search connection")
    logger.info("Refreshing all es indices")
    return connection.indices.refresh()


def doctypes():
    """List of all DocType subclasses"""
    return [item for item in globals().values()
            if type(item) == type(DocType) and
            issubclass(item, DocType) and
            item._doc_type.index]


def _init():
    if settings.ELASTIC_SEARCH["url"]:
        connection = connections.create_connection(
            hosts=[settings.ELASTIC_SEARCH["url"]],
            verify_certs=settings.ELASTIC_SEARCH["url"].startswith("https"),
            ca_certs=certifi.where(),
            timeout=20)
    else:
        return

    # Create any indices that are missing
    indices = connection.indices.get("*")
    for item in doctypes():
        if item._doc_type.index not in indices:
            item.init()
        connection.indices.put_mapping(doc_type=item._doc_type.name,
                                       index=item._doc_type.index,
                                       body={"_routing": {"required": True}})
    return connection


connection = _init()
