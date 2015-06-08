# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import json
import pytest

from django.core.urlresolvers import reverse

from treeherder.client.thclient import client

from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.model.derived import ArtifactsModel, JobsModel


xfail = pytest.mark.xfail


# we don't have/need an artifact list endpoint.

def test_artifact_detail(webapp, test_project, eleven_jobs_processed, sample_artifacts, jm):
    """
    test retrieving a single artifact from the artifact-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
    with ArtifactsModel(test_project) as artifacts_model:
        artifact = artifacts_model.get_job_artifact_references(job["id"])[0]

    resp = webapp.get(
        reverse("artifact-detail",
                kwargs={"project": jm.project, "pk": int(artifact["id"])})
    )

    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == artifact["id"]
    assert set(resp.json.keys()) == set([
        "job_id",
        "blob",
        "type",
        "id",
        "name"
    ])

    jm.disconnect()


def test_artifact_detail_not_found(webapp, jm):
    """
    test retrieving a HTTP 404 from the artifact-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("artifact-detail",
                kwargs={"project": jm.project, "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404

    jm.disconnect()


def test_artifact_detail_bad_project(webapp, jm):
    """
    test retrieving a HTTP 404 from the artifact-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("artifact-detail",
                kwargs={"project": "foo", "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404
    assert resp.json == {"detail": "No project with name foo"}

    jm.disconnect()


def test_artifact_create_text_log_summary(webapp, test_project, eleven_jobs_processed,
                                          mock_post_collection, mock_error_summary,
                                          sample_data):
    """
    test submitting a text_log_summary artifact which auto-generates bug suggestions
    """

    credentials = OAuthCredentials.get_credentials(test_project)

    with JobsModel(test_project) as jobs_model:
        job = jobs_model.get_job_list(0, 1)[0]
    tls = sample_data.text_log_summary

    tac = client.TreeherderArtifactCollection()
    ta = client.TreeherderArtifact({
        'type': 'json',
        'name': 'text_log_summary',
        'blob': json.dumps(tls['blob']),
        'job_guid': job['job_guid']
    })
    tac.add(ta)

    cli = client.TreeherderClient(protocol='http', host='localhost')
    credentials = OAuthCredentials.get_credentials(test_project)
    cli.post_collection(test_project, credentials['consumer_key'],
                        credentials['consumer_secret'], tac)

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job["id"])}
        })

    artifact_names = {x['name'] for x in artifacts}
    act_bs_obj = [x['blob'] for x in artifacts if x['name'] == 'Bug suggestions'][0]

    assert set(artifact_names) == {'Bug suggestions', 'text_log_summary'}
    assert mock_error_summary == act_bs_obj


def test_artifact_create_text_log_summary_and_bug_suggestions(
        webapp, test_project, eleven_jobs_processed,
        mock_post_collection, mock_error_summary,
        sample_data):
    """
    test submitting text_log_summary and Bug suggestions artifacts

    This should NOT generate a Bug suggestions artifact, just post the one
    submitted.
    """

    with JobsModel(test_project) as jobs_model:
        job = jobs_model.get_job_list(0, 1)[0]
    tls = sample_data.text_log_summary
    bs_blob = ["flim", "flam"]

    tac = client.TreeherderArtifactCollection()
    tac.add(client.TreeherderArtifact({
        'type': 'json',
        'name': 'text_log_summary',
        'blob': json.dumps(tls['blob']),
        'job_guid': job['job_guid']
    }))
    tac.add(client.TreeherderArtifact({
        'type': 'json',
        'name': 'Bug suggestions',
        'blob': bs_blob,
        'job_guid': job['job_guid']
    }))

    cli = client.TreeherderClient(protocol='http', host='localhost')
    credentials = OAuthCredentials.get_credentials(test_project)
    cli.post_collection(test_project, credentials['consumer_key'],
                        credentials['consumer_secret'], tac)

    with ArtifactsModel(test_project) as artifacts_model:
        artifacts = artifacts_model.get_job_artifact_list(0, 10, conditions={
            'job_id': {('=', job["id"])}
        })

    assert len(artifacts) == 2
    artifact_names = {x['name'] for x in artifacts}
    act_bs_obj = [x['blob'] for x in artifacts if x['name'] == 'Bug suggestions'][0]

    assert set(artifact_names) == {'Bug suggestions', 'text_log_summary'}
    assert bs_blob == act_bs_obj
