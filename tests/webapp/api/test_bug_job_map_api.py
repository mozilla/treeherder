import json
import random
from time import time

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient


def test_create_bug_job_map_no_auth(eleven_jobs_stored, jm):
    """
    test creating a single note via endpoint
    """
    client = APIClient()

    job = jm.get_job_list(0, 1)[0]

    bug_job_map_obj = {
        "job_id": job["id"],
        "bug_id": 1,
        "type": "manual"
    }

    resp = client.post(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj, expect_errors=True)

    assert resp.status_code == 403


def test_create_bug_job_map(eleven_jobs_stored, mock_message_broker, jm):
    """
    test creating a single note via endpoint
    """

    client = APIClient()
    user = User.objects.create(username="MyName", email="foo@bar.com")
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]

    bug_job_map_obj = {
        u"job_id": job["id"],
        u"bug_id": 1L,
        u"type": u"manual"
    }

    client.post(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj
    )

    bug_job_map_obj["who"] = user.email

    user.delete()

    actual_obj = jm.get_bug_job_map_list(0, 1)[0]
    del actual_obj["submit_timestamp"]

    assert bug_job_map_obj == actual_obj


def test_create_bug_job_map_dupe(eleven_jobs_stored, mock_message_broker, jm):
    """
    test creating the same bug map skips it
    """

    client = APIClient()
    user = User.objects.create(username="MyName", email="foo@bar.com")
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]

    bug_job_map_obj = {
        u"job_id": job["id"],
        u"bug_id": 1L,
        u"type": u"manual",
    }

    client.post(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj
    )

    client.post(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj
    )

    bug_job_map_obj["who"] = user.email

    user.delete()

    actual_obj = jm.get_bug_job_map_list(0, 1)[0]
    del actual_obj["submit_timestamp"]

    assert bug_job_map_obj == actual_obj


def test_bug_job_map_list(webapp, jm, eleven_jobs_stored):
    """
    test retrieving a list of bug_job_map
    """
    jobs = jm.get_job_list(0, 10)
    bugs = [random.randint(0, 100) for i in range(0, len(jobs))]
    submit_timestamp = int(time())
    who = "user@mozilla.com"

    expected = list()

    for i, v in enumerate(jobs):

        jm.insert_bug_job_map(v["id"], bugs[i],
                              "manual", submit_timestamp, who)
        expected.append({
            "job_id": v["id"],
            "bug_id": bugs[i],
            "type": "manual",
            "submit_timestamp": submit_timestamp,
            "who": who
        })
        submit_timestamp += 1

    resp = webapp.get(
        reverse("bug-job-map-list", kwargs={"project": jm.project}))

    # The order of the bug-job-map list is not guaranteed.
    assert sorted(resp.json) == sorted(expected)


def test_bug_job_map_detail(webapp, jm, eleven_jobs_stored):
    """
    test retrieving a list of bug_job_map
    """
    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = random.randint(0, 100)

    expected = list()

    submit_timestamp = int(time())
    who = "user@mozilla.com"
    jm.insert_bug_job_map(job_id, bug_id, "manual", submit_timestamp, who)

    pk = "{0}-{1}".format(job_id, bug_id)

    resp = webapp.get(
        reverse("bug-job-map-detail", kwargs={
            "project": jm.project,
            "pk": pk
        })
    )

    expected = {
        "job_id": job_id,
        "bug_id": bug_id,
        "type": "manual",
        "submit_timestamp": submit_timestamp,
        "who": who}

    assert resp.json == expected


def test_bug_job_map_delete(webapp, eleven_jobs_stored,
                            jm, mock_message_broker):
    """
    test retrieving a list of bug_job_map
    """
    client = APIClient()
    user = User.objects.create(username="MyName", is_staff=True)
    client.force_authenticate(user=user)

    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = random.randint(0, 100)

    submit_timestamp = int(time())
    who = "user@mozilla.com"

    jm.insert_bug_job_map(job_id, bug_id,
                          "manual", submit_timestamp, who)

    pk = "{0}-{1}".format(job_id, bug_id)

    resp = client.delete(
        reverse("bug-job-map-detail", kwargs={
            "project": jm.project,
            "pk": pk
        })
    )

    user.delete()

    content = json.loads(resp.content)
    assert content == {"message": "Bug job map deleted"}


def test_bug_job_map_delete_no_auth(jm, eleven_jobs_stored):
    """
    test retrieving a list of bug_job_map
    """
    client = APIClient()

    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = random.randint(0, 100)

    submit_timestamp = int(time())
    who = "user@mozilla.com"

    jm.insert_bug_job_map(job_id, bug_id, "manual",
                          submit_timestamp, who)

    pk = "{0}-{1}".format(job_id, bug_id)

    resp = client.delete(
        reverse("bug-job-map-detail", kwargs={
            "project": jm.project,
            "pk": pk
        })
    )

    assert resp.status_code == 403
