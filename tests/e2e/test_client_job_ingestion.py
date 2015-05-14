# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from treeherder import client

from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.model.derived import JobsModel


def test_post_job_with_parsed_log(test_project, result_set_stored,
                                  mock_post_collection):
    """
    test submitting a job with a pre-parsed log gets the right job_log_url
    parse_status value.
    """

    credentials = OAuthCredentials.get_credentials(test_project)

    tjc = client.TreeherderJobCollection()
    tj = client.TreeherderJob({
        'project': test_project,
        'revision_hash': result_set_stored[0]['revision_hash'],
        'job': {
            'job_guid': 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33',
            'state': 'completed',
            'log_references': [{
                'url': 'http://ftp.mozilla.org/pub/mozilla.org/spidermonkey/...',
                'name': 'builbot_text',
                'parse_status': 'parsed'
            }]
        }
    })

    tjc.add(tj)

    cli = client.TreeherderClient(protocol='http', host='localhost')

    # Post the request to treeherder
    cli.post_collection(test_project, credentials['consumer_key'],
                        credentials['consumer_secret'], tjc)

    # assume if there were no exceptions we're ok

    with JobsModel(test_project) as jm:
        jm.process_objects(10)

        job_ids = [x['id'] for x in jm.get_job_list(0, 20)]
        job_log_list = jm.get_job_log_url_list(job_ids)

        assert len(job_log_list) == 1
        assert job_log_list[0]['parse_status'] == 'parsed'
