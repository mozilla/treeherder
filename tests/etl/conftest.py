import pytest
from webtest.app import TestApp
from treeherder.etl.mixins import JsonLoaderMixin
from treeherder.webapp.wsgi import application
from treeherder.etl import common

@pytest.fixture
def mock_post_json_data(monkeypatch):
    """mock the urllib call replacing it with a webtest call"""
    def _post_json_data(adapter, url, data):
        response = TestApp(application).post_json(url, params=data)
        response.getcode = lambda: response.status_int
        return response

    monkeypatch.setattr(JsonLoaderMixin, 'load', _post_json_data)


@pytest.fixture
def mock_get_remote_content(monkeypatch):
    def _get_remote_content(url):
        response = TestApp(application).get(url)
        if response.status_int != 200:
            return None
        else:
            return response.json

    monkeypatch.setattr(common,
                        'get_remote_content', _get_remote_content)
