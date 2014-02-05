import pytest
import json
from webtest.app import TestApp
from treeherder.etl.mixins import JsonLoaderMixin, OAuthLoaderMixin
from treeherder.webapp.wsgi import application
from treeherder.etl import common

from thclient import TreeherderRequest
from tests.sampledata import SampleData

@pytest.fixture
def mock_post_json_data(monkeypatch, jm):
    def _post_json_data(url, data):

        th_collection = data[jm.project]

        OAuthLoaderMixin.set_credentials( SampleData.get_credentials() )
        credentials = OAuthLoaderMixin.get_credentials(jm.project)

        tr = TreeherderRequest(
            protocol='http',
            host='localhost',
            project=jm.project,
            oauth_key=credentials['consumer_key'],
            oauth_secret=credentials['consumer_secret']
            )
        signed_uri = tr.get_signed_uri(
            th_collection.to_json(), tr.get_uri(th_collection)
            )

        response = TestApp(application).post_json(
            str(signed_uri), params=th_collection.get_collection_data()
            )

        response.getcode = lambda: response.status_int
        return response

    monkeypatch.setattr(OAuthLoaderMixin, 'load', _post_json_data)


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
