from django.core.urlresolvers import reverse
from rest_framework.test import APIClient
from django.contrib.auth.models import User
import random
import json


def test_create_bug_job_map_no_auth(eleven_jobs_processed, jm):
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


def test_create_bug_job_map(eleven_jobs_processed, mock_message_broker, jm):
    """
    test creating a single note via endpoint
    """

    client = APIClient()
    user = User.objects.create(username="MyName", is_staff=True)
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]

    bug_job_map_obj = {
        "job_id": job["id"],
        "bug_id": 1,
        "type": "manual"
    }

    client.post(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj
    )

    user.delete()

    assert (bug_job_map_obj,) == jm.get_bug_job_map_list(0, 1)


def test_create_bug_job_map_dup(eleven_jobs_processed, mock_message_broker, jm):
    """
    test creating the same bug map skips it
    """

    client = APIClient()
    user = User.objects.create(username="MyName", is_staff=True)
    client.force_authenticate(user=user)

    job = jm.get_job_list(0, 1)[0]

    bug_job_map_obj = {
        "job_id": job["id"],
        "bug_id": 1,
        "type": "manual"
    }

    client.post(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj
    )

    client.post(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj
    )

    user.delete()

    assert (bug_job_map_obj,) == jm.get_bug_job_map_list(0, 1)


def test_bug_job_map_list(webapp, jm, eleven_jobs_processed):
    """
    test retrieving a list of bug_job_map
    """
    jobs = jm.get_job_list(0, 10)
    bugs = [random.randint(0, 100) for i in range(0, len(jobs))]

    expected = list()

    for i, v in enumerate(jobs):
        jm.insert_bug_job_map(v["id"], bugs[i], "manual")
        expected.append({
            "job_id": v["id"],
            "bug_id": bugs[i],
            "type": "manual"})

    resp = webapp.get(
        reverse("bug-job-map-list", kwargs={"project": jm.project}))

    for i, v in enumerate(expected):
        assert v == resp.json[i]

def test_bug_job_map_detail(webapp, jm, eleven_jobs_processed):
    """
    test retrieving a list of bug_job_map
    """
    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = random.randint(0, 100)

    expected = list()

    jm.insert_bug_job_map(job_id, bug_id, "manual")

    pk = "{0}-{1}".format(job_id, bug_id)

    resp = webapp.get(
        reverse("bug-job-map-detail", kwargs={
            "project": jm.project,
            "pk": pk
        })
    )

    assert resp.json == {"job_id": job_id, "bug_id": bug_id, "type": "manual"}


def test_bug_job_map_delete(webapp, eleven_jobs_processed,
                            jm, mock_message_broker):
    """
    test retrieving a list of bug_job_map
    """
    client = APIClient()
    user = User.objects.create(username="MyName", is_staff=True)
    client.force_authenticate(user=user)

    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = random.randint(0, 100)

    jm.insert_bug_job_map(job_id, bug_id, "manual")

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


def test_bug_job_map_delete_no_auth(jm, eleven_jobs_processed):
    """
    test retrieving a list of bug_job_map
    """
    client = APIClient()

    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = random.randint(0, 100)

    jm.insert_bug_job_map(job_id, bug_id, "manual")

    pk = "{0}-{1}".format(job_id, bug_id)



    resp = client.delete(
        reverse("bug-job-map-detail", kwargs={
            "project": jm.project,
            "pk": pk
        })
    )

    assert resp.status_code == 403
