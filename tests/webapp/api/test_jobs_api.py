import json

from django.core.urlresolvers import reverse


def test_update_state_success(webapp, eleven_jobs_processed, jm):
    """
    test setting the state of a job via webtest.
    extected result are:
    - return code 200
    - return message successful
    - job status updated
    """

    job = jm.get_job_list(0, 1)[0]
    job_id = job["id"]
    new_state = "coalesced"

    # use the backdoor to set the state of the job to something we can
    # change.  because we can't change it once it's ``completed``
    jm.get_jobs_dhub().execute(
        proc='jobs_test.updates.set_state_any',
        placeholders=["running", job_id],
    )

    url = reverse("jobs-update-state", kwargs={
        "project": jm.project,
        "pk": job_id
    })

    resp = webapp.post(url, params={"state": new_state})

    assert resp.status_int == 200
    assert resp.json["message"] == "state updated to '{0}'".format(new_state)
    assert jm.get_job(job_id)[0]["state"] == new_state


def test_update_state_invalid_state(webapp, eleven_jobs_processed, jm):
    """
    test setting the state of a job via webtest with invalid state.
    extected result are:
    - return code 400
    """

    job = jm.get_job_list(0, 1)[0]
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
    assert jm.get_job(job_id)[0]["state"] == old_state


def test_update_state_invalid_job_id(webapp, eleven_jobs_processed, jm):
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


def test_job_list(webapp, eleven_jobs_processed, jm):
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


def test_job_list_bad_project(webapp, eleven_jobs_processed, jm):
    """
    test retrieving a job list with a bad project throws 404.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    badurl = url.replace(jm.project, "badproject")

    webapp.get(badurl, status=404)


def test_job_detail(webapp, eleven_jobs_processed, sample_artifacts, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]

    resp = webapp.get(
        reverse("jobs-detail",
                kwargs={"project": jm.project, "pk": job["id"]})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, dict)
    assert resp.json["id"] == job["id"]


def test_job_detail_bad_project(webapp, eleven_jobs_processed, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
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
                kwargs={"project": jm.project, "pk": -32767}),
        expect_errors=True
    )
    assert resp.status_int == 404


def test_retrieve_result_set(jm, webapp, eleven_jobs_processed):
    resp = webapp.get(
        reverse("resultset-list",
                kwargs={"project": jm.project})
    )
    assert resp.status_int == 200
    assert isinstance(resp.json, list)


def test_retrieve_result_set_detail(jm, webapp, eleven_jobs_processed):
    job = jm.get_job_list(0, 1)[0]
    resp = webapp.get(
        reverse("resultset-detail",
                kwargs={"project": jm.project, "pk": job["id"]})
    )
    assert resp.status_int == 200
