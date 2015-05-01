# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from treeherder import client

from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.model.derived import JobsModel, ArtifactsModel


def test_post_job_with_parsed_log(test_project, result_set_stored,
                                  mock_send_request):
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

    req = client.TreeherderRequest(
        protocol='http',
        host='localhost',
        project=test_project,
        oauth_key=credentials['consumer_key'],
        oauth_secret=credentials['consumer_secret']
        )

    # Post the request to treeherder
    resp = req.post(tjc)
    assert resp.status_int == 200
    assert resp.body == '{"message": "well-formed JSON stored"}'

    with JobsModel(test_project) as jm:
        jm.process_objects(10)

        job_ids = [x['id'] for x in jm.get_job_list(0, 20)]
        job_log_list = jm.get_job_log_url_list(job_ids)

        assert len(job_log_list) == 1
        assert job_log_list[0]['parse_status'] == 'parsed'


def test_post_job_with_text_log_summary_artifact(test_project,
                                                 result_set_stored,
                                                 mock_send_request):
    """
    test submitting a job with a pre-parsed log gets the right job_log_url
    parse_status value.
    """

    credentials = OAuthCredentials.get_credentials(test_project)

    job_guid = 'd22c74d4aa6d2a1dcba96d95dccbd5fdca70cf33'
    tjc = thclient.TreeherderJobCollection()
    tj = thclient.TreeherderJob({
        'project': test_project,
        'revision_hash': result_set_stored[0]['revision_hash'],
        'job': {
            'job_guid': job_guid,
            'state': 'completed',
            'artifacts': [{
                "blob": """
                    {
                    "header": {},
                    "step_data": {
                           "all_errors": [
                               {
                               "line": "\u001b7\u001b8\u001b[1G\u001b[J\u001b[34m 6:49.97\u001b(B\u001b[m /home/worker/workspace/gecko/toolkit/xre/nsAppRunner.cpp:108:40: fatal error: mozilla/a11y/Compatibility.h: No such file or directory",
                               "linenumber": 955
                               }
                            ],
                           "steps": [
                               {"name": "Clone gecko tc-vcs "},
                               {"name": "Build ./build-b2g-desktop.sh /home/worker/workspace"}
                            ],
                           "errors_truncated": false},
                       "logurl": "https://queue.taskcluster.net/v1/task/nhxC4hC3RE6LSVWTZT4rag/runs/0/artifacts/public/logs/live_backing.log"}
                       """,
                "type": "json",
                "name": "text_log_summary",
                "job_guid": job_guid
            }]
        }
    })

    tjc.add(tj)

    req = thclient.TreeherderRequest(
        protocol='http',
        host='localhost',
        project=test_project,
        oauth_key=credentials['consumer_key'],
        oauth_secret=credentials['consumer_secret']
        )

    # Post the request to treeherder
    resp = req.post(tjc)
    assert resp.status_int == 200
    assert resp.body == '{"message": "well-formed JSON stored"}'

    with JobsModel(test_project) as jobs_model, \
            ArtifactsModel(test_project) as artifacts_model:

        jobs_model.process_objects(10)

        job_ids = [x['id'] for x in jobs_model.get_job_list(0, 20)]
        artifacts = artifacts_model.get_job_artifact_references(job_ids[0])
        artifact_names = {x['name'] for x in artifacts}
        assert {'Bug suggestions', 'text_log_summary'} == artifact_names
