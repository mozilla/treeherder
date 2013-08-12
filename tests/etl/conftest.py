import pytest
from webtest.app import TestApp
from treeherder.etl.mixins import JsonLoaderMixin
from treeherder.webapp.wsgi import application


@pytest.fixture
def mock_post_json_data():
    """mock the urllib call replacing it with a webtest call"""
    def _post_json_data(adapter, url, data):
        response = TestApp(application).post_json(url, params=data)
        response.getcode = lambda: response.status_int
        return response

    old_func = JsonLoaderMixin.load
    JsonLoaderMixin.load = _post_json_data

    # on tearDown, re-set the original function
    def fin():
        JsonLoaderMixin._post_json_data = old_func
