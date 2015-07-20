# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.core.urlresolvers import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User

import json


def test_job_list(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a list of ten json blobs from the jobs-list
    endpoint.
    """
    resp = webapp.get(
        reverse("jobs-list",
                kwargs={"project": jm.project})
    )
    assert resp.status_int == 200
    response_dict = resp.json
    jobs = response_dict["results"]
    assert isinstance(jobs, list)
    assert len(jobs) == 10
    exp_keys = [
        "submit_timestamp",
        "start_timestamp",
        "result_set_id",
        "who",
        "option_collection_hash",
        "reason",
        "id",
        "job_guid",
        "state",
        "result",
        "device_name",
        "build_platform_id",
        "job_coalesced_to_guid",
        "end_timestamp",
        "build_platform",
        "machine_name",
        "job_group_id",
        "job_group_symbol",
        "job_group_name",
        "job_type_id",
        "job_type_name",
        "job_type_description",
        "build_architecture",
        "build_system_type",
        "job_type_symbol",
        "platform",
        "job_group_description",
        "platform_option",
        "machine_platform_os",
        "build_os",
        "machine_platform_architecture",
        "failure_classification_id",
        "pending_eta",
        "running_eta",
        "tier",
        "last_modified",
        "ref_data_name",
        "signature"
    ]
    for job in jobs:
        assert set(job.keys()) == set(exp_keys)

    # The jobs should be returned in order of descending order
    # of their resultset's push_timestamp, so in this case the
    # first job should have id of 10.
    assert jobs[0]['id'] == 10


def test_job_list_bad_project(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a job list with a bad project throws 404.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    badurl = url.replace(jm.project, "badproject")

    webapp.get(badurl, status=404)


def test_job_list_equals_filter(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a job list with a querystring filter.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    final_url = url + "?job_guid=f1c75261017c7c5ce3000931dce4c442fe0a1297"

    resp = webapp.get(final_url).json

    assert len(resp['results']) == 1


def test_job_list_in_filter(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a job list with a querystring filter.
    """
    url = reverse("jobs-list",
                  kwargs={"project": jm.project})
    final_url = url + ("?job_guid__in="
                       "f1c75261017c7c5ce3000931dce4c442fe0a1297,"
                       "9abb6f7d54a49d763c584926377f09835c5e1a32")

    resp = webapp.get(final_url).json
    assert len(resp['results']) == 2


def test_job_detail(webapp, eleven_jobs_stored, sample_artifacts, jm):
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

    jm.disconnect()


def test_job_retrigger_unauthorized(webapp, eleven_jobs_stored, jm):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
    url = reverse("jobs-retrigger",
                  kwargs={"project": jm.project, "pk": job["id"]})
    webapp.post(url, status=403)


def test_job_retrigger_authorized(webapp, eleven_jobs_stored, jm,
                                  pulse_action_consumer):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    client = APIClient()
    email = "foo-retrigger@example.com"
    user = User.objects.create(username="retrigger-fail", email=email)
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]
    url = reverse("jobs-retrigger",
                  kwargs={"project": jm.project, "pk": job["id"]})
    client.post(url)

    message = pulse_action_consumer.get(block=True, timeout=2)
    content = json.loads(message.body)

    assert content['project'] == jm.project
    assert content['action'] == 'retrigger'
    assert content['job_guid'] == job['job_guid']
    assert content['requester'] == email
    user.delete()


def test_job_cancel_authorized(webapp, eleven_jobs_stored, jm,
                               pulse_action_consumer):
    """
    Validate that only authenticated users can hit this endpoint.
    """
    client = APIClient()
    email = "cancel@example.com"
    user = User.objects.create(username="retrigger", email=email)
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]
    url = reverse("jobs-cancel",
                  kwargs={"project": jm.project, "pk": job["id"]})
    client.post(url)

    message = pulse_action_consumer.get(block=True, timeout=2)
    content = json.loads(message.body)

    assert content['project'] == jm.project
    assert content['action'] == 'cancel'
    assert content['job_guid'] == job['job_guid']
    assert content['requester'] == email
    user.delete()


def test_job_detail_bad_project(webapp, eleven_jobs_stored, jm):
    """
    test retrieving a single job from the jobs-detail
    endpoint.
    """
    job = jm.get_job_list(0, 1)[0]
    url = reverse("jobs-detail",
                  kwargs={"project": jm.project, "pk": job["id"]})
    badurl = url.replace(jm.project, "badproject")

    webapp.get(badurl, status=404)

    jm.disconnect()


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
