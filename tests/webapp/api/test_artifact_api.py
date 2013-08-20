import json
import pytest
from django.core.urlresolvers import reverse

xfail = pytest.mark.xfail


# we don't have/need an artifact list endpoint.

def test_artifact_detail(webapp, eleven_jobs_processed, sample_artifacts, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
    artifact = jm.get_job_artifact_references(job["id"])[0]

    resp = webapp.get(
        reverse("artifact-detail",
                kwargs={"project": jm.project, "pk": int(artifact["id"])})
    )

    print json.dumps(resp.json.keys(), indent=4)

    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == artifact["id"]
    assert resp.json.keys() == [
        "job_id",
        "active_status",
        "blob",
        "type",
        "id",
        "name"
    ]


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
    assert resp.json == {
        "message": ("ObjectNotFoundException: For table 'job_artifacts':"
                    " {'id': u'-32767'}")
    }


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
    assert resp.json == {"message": "No project with name foo"}

