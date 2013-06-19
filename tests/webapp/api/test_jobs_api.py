import json

from django.core.urlresolvers import reverse


def test_update_state_success(webapp, ten_jobs_processed, jm):
    """
    test setting the state of a job via webtest.
    extected result are:
    - return code 200
    - return message successful
    - job status updated
    """

    joblist = jm.get_job_list(0, 1)
    job = joblist.next()

    job_id = job["id"]
    new_state = "pending"

    url = reverse("jobs-update-state", kwargs={
        "project": jm.project,
        "pk": job_id
    })

    resp = webapp.post(url, params={"state": new_state})

    assert resp.status_int == 200
    assert resp.json["message"] == "state updated to 'pending'"
    assert jm.get_job(job_id)["state"] == new_state


def test_update_state_invalid_state(webapp, ten_jobs_processed, jm):
    """
    test setting the state of a job via webtest with invalid state.
    extected result are:
    - return code 400
    """

    joblist = jm.get_job_list(0, 1)
    job = joblist.next()

    job_id = job["id"]
    old_state = job["state"]
    new_state = "chokey"

    url = reverse("jobs-update-state", kwargs={
        "project": jm.project,
        "pk": job_id
    })

    resp = webapp.post(url, params={"state": new_state}, status=400)

    assert resp.json["message"] == ("'{0}' is not a valid state.  Must be "
                                    "one of: {1}".format(
                                        new_state,
                                        ", ".join(jm.STATES)
                                    ))
    assert jm.get_job(job_id)["state"] == old_state


def test_update_state_invalid_job_id(webapp, ten_jobs_processed, jm):
    """
    test setting the state of a job via webtest with invalid job_id.
    extected result are:
    - return code 404
    """

    job_id = -32767
    new_state = "pending"

    url = reverse("jobs-update-state", kwargs={
        "project": jm.project,
        "pk": job_id
    })

    webapp.post(url, params={"state": new_state}, status=404)


def test_job_list(webapp, ten_jobs_processed, jm):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = webapp.get(
        reverse("jobs-list",
                kwargs={"project": jm.project})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, list)
    assert len(resp.json) == 10
    jobs = resp.json
    exp_keys = [
        "submit_timestamp",
        "start_timestamp",
        "result_set_id",
        "product_id",
        "who",
        "option_collection_hash",
        "reason",
        "active_status",
        "id",
        "job_guid",
        "state",
        "job_type_id",
        "result",
        "build_platform_id",
        "machine_platform_id",
        "machine_id",
        "job_coalesced_to_guid",
        "end_timestamp"
    ]
    for job in jobs:
        assert set(job.keys()) == set(exp_keys)


def test_job_list_bad_project(webapp, ten_jobs_processed, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    badurl = url.replace(jm.project, "badproject")

    webapp.get(badurl, status=404)


def test_job_detail(webapp, ten_jobs_processed, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1).next()

    resp = webapp.get(
        reverse("jobs-detail",
                kwargs={"project": jm.project, "pk": job["id"]})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == job["id"]


def test_job_detail_bad_project(webapp, ten_jobs_processed, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1).next()
    url = reverse("jobs-detail",
                  kwargs={"project": jm.project, "pk": job["id"]})
    badurl = url.replace(jm.project, "badproject")

    webapp.get(badurl, status=404)


def test_job_detail_not_found(webapp, jm):
    """
    test retrieving a HTTP 404 from the jobs-detail
    endpoint.
    """
    resp = webapp.get(
        reverse("jobs-detail",
                kwargs={"project": jm.project, "pk": 32767}),
        expect_errors=True
    )
    print resp
    assert resp.status_int == 404
