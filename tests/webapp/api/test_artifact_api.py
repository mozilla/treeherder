import json

import pytest
from django.core.urlresolvers import reverse

from treeherder.client.thclient import client
from treeherder.model.derived import (ArtifactsModel,
                                      JobsModel)
from treeherder.model.models import (TextLogError,
                                     TextLogStep)

xfail = pytest.mark.xfail


# we don't have/need an artifact list endpoint.

def test_artifact_detail(webapp, test_project, eleven_jobs_stored, sample_artifacts, jm):
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


def test_artifact_create_text_log_summary(webapp, test_project, test_job,
                                          mock_post_json, sample_data):
    """
    test submitting a text_log_summary artifact creates some text log summary objects
    """
    with JobsModel(test_project) as jobs_model:
        job = jobs_model.get_job_list(0, 1)[0]
    tls = sample_data.text_log_summary

    # assert that we had no text log objects before this operation
    assert not TextLogStep.objects.filter(
        job__guid=job['job_guid']).exists()

    tac = client.TreeherderArtifactCollection()
    ta = client.TreeherderArtifact({
        'type': 'json',
        'name': 'text_log_summary',
        'blob': json.dumps(tls['blob']),
        'job_guid': job['job_guid']
    })
    tac.add(ta)

    cli = client.TreeherderClient(server_url='http://localhost')
    cli.post_collection(test_project,  tac)

    # assert we generated some objects
    assert TextLogStep.objects.filter(
        job__guid=job['job_guid']).count() > 0
    assert TextLogError.objects.filter(
        step__job__guid=job['job_guid']).count() > 0
