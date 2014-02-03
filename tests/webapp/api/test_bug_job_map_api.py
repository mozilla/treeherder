from django.core.urlresolvers import reverse
import random


def test_create_bug_job_map(webapp, eleven_jobs_processed, jm):
    """
    test creating a single note via endpoint
    """
    job = jm.get_job_list(0, 1)[0]

    bug_job_map_obj = {
        "job_id": job["id"],
        "bug_id": 1,
        "type": "manual"
    }

    resp = webapp.post_json(
        reverse("bug-job-map-list", kwargs={"project": jm.project}),
        bug_job_map_obj)

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


def test_bug_job_map_delete(webapp, jm, eleven_jobs_processed):
    """
    test retrieving a list of bug_job_map
    """
    job_id = jm.get_job_list(0, 1)[0]["id"]
    bug_id = random.randint(0, 100)

    jm.insert_bug_job_map(job_id, bug_id, "manual")

    pk = "{0}-{1}".format(job_id, bug_id)



    resp = webapp.delete_json(
        reverse("bug-job-map-detail", kwargs={
            "project": jm.project,
            "pk": pk
        })
    )

    assert resp.json == {"message": "Bug job map deleted"}
