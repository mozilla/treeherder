import json
import random

import pytest
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient

from treeherder.model.models import (BugJobMap,
                                     Job)


@pytest.mark.parametrize('test_no_auth,test_duplicate_handling', [
    (True, False),
    (False, False),
    (False, True)])
def test_create_bug_job_map(eleven_jobs_stored, mock_message_broker, jm,
                            test_user, test_no_auth, test_duplicate_handling):
    """
    test creating a single note via endpoint
    """

    client = APIClient()
    if not test_no_auth:
        client.force_authenticate(user=test_user)

    job = jm.get_job_list(0, 1)[0]

    submit_obj = {
        u"job_id": job["id"],
        u"bug_id": 1L,
        u"type": u"manual"
    }

    # if testing duplicate handling, submit twice
    if test_duplicate_handling:
        num_times = 2
    else:
        num_times = 1

    for i in range(num_times):
        resp = client.post(
            reverse("bug-job-map-list", kwargs={"project": jm.project}),
            submit_obj, expect_errors=test_no_auth)

    if test_no_auth:
        assert resp.status_code == 403
        assert BugJobMap.objects.count() == 0
    else:
        assert BugJobMap.objects.count() == 1
        bug_job_map = BugJobMap.objects.all()[0]

        assert bug_job_map.job_id == submit_obj['job_id']
        assert bug_job_map.bug_id == 1L
        assert bug_job_map.user == test_user


def test_bug_job_map_list(webapp, jm, eleven_jobs_stored, test_user):
    """
    test retrieving a list of bug_job_map
    """
    jobs = Job.objects.all()[:10]
    bugs = [random.randint(0, 100) for i in range(0, len(jobs))]

    expected = list()

    for (i, job) in enumerate(jobs):
        bjm = BugJobMap.objects.create(job=job, bug_id=bugs[i],
                                       user=test_user)
        expected.append({
            "job_id": job.id,
            "bug_id": bugs[i],
            "created": bjm.created.isoformat(),
            "who": test_user.email
        })

    # verify that API works with different combinations of job_id= parameters
    for job_range in [(0, 1), (0, 2), (0, 9)]:
        resp = webapp.get(
            reverse("bug-job-map-list", kwargs={"project": jm.project}),
            params={'job_id': [job.id for job in
                               jobs[job_range[0]:job_range[1]]]})

        # The order of the bug-job-map list is not guaranteed.
        assert sorted(resp.json) == sorted(expected[job_range[0]:job_range[1]])


def test_bug_job_map_detail(webapp, eleven_jobs_stored, test_repository,
                            test_user):
    """
    test retrieving a list of bug_job_map
    """
    job = Job.objects.all()[0]
    bug_id = random.randint(0, 100)

    expected = list()

    bjm = BugJobMap.objects.create(job=job,
                                   bug_id=bug_id,
                                   user=test_user)

    pk = "{0}-{1}".format(job.id, bug_id)

    resp = webapp.get(
        reverse("bug-job-map-detail", kwargs={
            "project": test_repository.name,
            "pk": pk
        })
    )

    expected = {
        "job_id": job.id,
        "bug_id": bug_id,
        "created": bjm.created.isoformat(),
        "who": test_user.email
    }

    assert resp.json == expected


@pytest.mark.parametrize('test_no_auth', [True, False])
def test_bug_job_map_delete(webapp, eleven_jobs_stored, test_repository,
                            test_user, test_no_auth):
    """
    test deleting a bug_job_map object
    """
    job = Job.objects.all()[0]
    bug_id = random.randint(0, 100)

    BugJobMap.objects.create(job=job,
                             bug_id=bug_id,
                             user=test_user)

    client = APIClient()
    if not test_no_auth:
        client.force_authenticate(user=test_user)

    pk = "{0}-{1}".format(job.id, bug_id)

    resp = client.delete(
        reverse("bug-job-map-detail", kwargs={
            "project": test_repository.name,
            "pk": pk
        })
    )

    if test_no_auth:
        assert resp.status_code == 403
        assert BugJobMap.objects.count() == 1
    else:
        content = json.loads(resp.content)
        assert content == {"message": "Bug job map deleted"}
        assert BugJobMap.objects.count() == 0
