# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest
from django.core.urlresolvers import reverse
from treeherder.model.derived import ArtifactsModel

xfail = pytest.mark.xfail


# we don't have/need an artifact list endpoint.

def test_artifact_detail(webapp, test_project, eleven_jobs_processed, sample_artifacts, jm):
    """
    test retrieving a single job from the jobs-detail
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
