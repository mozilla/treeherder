import pytest
from webtest.app import TestApp

from thclient import TreeherderRequest

from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.webapp.wsgi import application

from tests.sampledata import SampleData


@pytest.fixture
def mock_send_request(monkeypatch, jm):
    def _send(th_request, th_collection):

        OAuthCredentials.set_credentials(SampleData.get_credentials())
        credentials = OAuthCredentials.get_credentials(jm.project)

        th_request.oauth_key = credentials['consumer_key']
        th_request.oauth_secret = credentials['consumer_secret']

        signed_uri = th_request.get_signed_uri(
            th_collection.to_json(), th_request.get_uri(th_collection)
        )

        response = TestApp(application).post_json(
            str(signed_uri), params=th_collection.get_collection_data()
        )

        response.getcode = lambda: response.status_int
        return response

    monkeypatch.setattr(TreeherderRequest, 'send', _send)
