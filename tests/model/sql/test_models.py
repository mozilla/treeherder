from contextlib import contextmanager


def create_datasource(model, **kwargs):
    """Utility function to easily create a test DataSource."""

    defaults = {
        "project": "foo",
    }

    defaults.update(kwargs)

    if "name" not in defaults:
        defaults["name"] = defaults["project"]

    return model.objects.create(**defaults)


@contextmanager
def assert_num_queries(queries):
    from django.db import connection
    _old_debug_cursor = connection.force_debug_cursor
    connection.force_debug_cursor = True
    start_queries = len(connection.queries)
    try:
        yield
        total = len(connection.queries) - start_queries
        msg = "Expected {0} queries, executed {1}".format(queries, total)
        assert total == queries, msg
    finally:
        connection.force_debug_cursor = _old_debug_cursor


def pytest_funcarg__DataSource(request):
    """
    Gives a test access to the DataSource model class.

    """
    from treeherder.model.models import Datasource
    return Datasource


def test_datasources_cached(DataSource):
    """Requesting the full list of DataSources twice only hits the DB once."""
    create_datasource(DataSource)

    DataSource.objects.cached()

    with assert_num_queries(0):
        DataSource.objects.cached()


def test_datasource_cache_invalidated(DataSource):
    """Saving a new datasource invalidates the datasource cache."""
    # prime the cache
    initial = DataSource.objects.cached()

    # create a new datasource
    create_datasource(DataSource)

    print DataSource.objects.all()

    # new datasource appears in the list immediately
    assert len(DataSource.objects.cached()) == len(initial) + 1
