# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from webtest.app import TestApp

from treeherder.etl.mixins import OAuthLoaderMixin
from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.webapp.wsgi import application

from treeherder.client import TreeherderClient
from tests.sampledata import SampleData


@pytest.fixture
def mock_post_json_data(monkeypatch, jm):
    def _post_json_data(url, data, chunk_size=1):
        # does not do any chunking in this test
        if data:
            th_collection = data[jm.project]

            OAuthCredentials.set_credentials(SampleData.get_credentials())
            credentials = OAuthCredentials.get_credentials(jm.project)

            cli = TreeherderClient(protocol='http',
                                   host='localhost')

            signed_uri = cli._get_uri(jm.project, th_collection.endpoint_base,
                                      data=th_collection.to_json(),
                                      oauth_key=credentials['consumer_key'],
                                      oauth_secret=credentials['consumer_secret'],
                                      method='POST')

            response = TestApp(application).post_json(
                str(signed_uri), params=th_collection.get_collection_data()
            )

            response.getcode = lambda: response.status_int
            return response

    monkeypatch.setattr(OAuthLoaderMixin, 'load', _post_json_data)
