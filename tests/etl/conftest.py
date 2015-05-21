# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
import json
from webtest.app import TestApp
from urllib2 import HTTPError

from treeherder.webapp.wsgi import application

from treeherder import client


@pytest.fixture
def mock_post_json_data(monkeypatch, set_oauth_credentials):

    def _mock_post_json(thisone, project, endpoint, oauth_key, oauth_secret, jsondata, timeout):

        thisone.protocol = 'http'
        thisone.host = 'localhost'

        uri = thisone._get_uri(project, endpoint, data=jsondata,
                               oauth_key=oauth_key,
                               oauth_secret=oauth_secret,
                               method='POST')

        resp = TestApp(application).post_json(
            str(uri), params=json.loads(jsondata)
        )

        if resp.status_int != 200:
            raise HTTPError(uri,
                            resp.status_int,
                            "Bad status in mock: {}".format(resp.status_int),
                            None,
                            jsondata)

    monkeypatch.setattr(client.TreeherderClient, "_post_json", _mock_post_json)
