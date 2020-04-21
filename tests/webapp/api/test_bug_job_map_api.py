import json

import pytest
from django.urls import reverse

from treeherder.model.models import BugJobMap, Job


@pytest.mark.parametrize(
    'test_no_auth,test_duplicate_handling', [(True, False), (False, False), (False, True)]
)
def test_create_bug_job_map(
    client, test_job, test_user, bugs, test_no_auth, test_duplicate_handling
):
    """
    test creating a single note via endpoint
    """
    bug = bugs[0]
    if not test_no_auth:
        client.force_authenticate(user=test_user)

    submit_obj = {u"job_id": test_job.id, u"bug_id": bug.id, u"type": u"manual"}

    # if testing duplicate handling, submit twice
    if test_duplicate_handling:
        num_times = 2
    else:
        num_times = 1

    for _ in range(num_times):
        resp = client.post(
            reverse("bug-job-map-list", kwargs={"project": test_job.repository.name}),
            data=submit_obj,
        )

    if test_no_auth:
        assert resp.status_code == 403
        assert BugJobMap.objects.count() == 0
    else:
        assert BugJobMap.objects.count() == 1
        bug_job_map = BugJobMap.objects.first()

        assert bug_job_map.job_id == submit_obj['job_id']
        assert bug_job_map.bug_id == submit_obj['bug_id']
        assert bug_job_map.user == test_user


def test_bug_job_map_list(client, test_repository, eleven_jobs_stored, test_user, bugs):
    """
    test retrieving a list of bug_job_map
    """
    jobs = Job.objects.all()[:10]

    expected = list()

    for (i, job) in enumerate(jobs):
        bjm = BugJobMap.create(job_id=job.id, bug_id=bugs[i].id, user=test_user,)

        expected.append(
            {
                "job_id": job.id,
                "bug_id": bugs[i].id,
                "created": bjm.created.isoformat(),
                "who": test_user.email,
            }
        )

    # verify that API works with different combinations of job_id= parameters
    for job_range in [(0, 1), (0, 2), (0, 9)]:
        resp = client.get(
            reverse("bug-job-map-list", kwargs={"project": test_repository.name}),
            data={'job_id': [job.id for job in jobs[job_range[0] : job_range[1]]]},
        )
        assert resp.status_code == 200
        assert resp.json() == expected[job_range[0] : job_range[1]]


def test_bug_job_map_detail(client, eleven_jobs_stored, test_repository, test_user, bugs):
    """
    test retrieving a list of bug_job_map
    """
    job = Job.objects.first()
    bug = bugs[0]
    expected = list()

    bjm = BugJobMap.create(job_id=job.id, bug_id=bug.id, user=test_user,)

    pk = "{0}-{1}".format(job.id, bug.id)

    resp = client.get(
        reverse("bug-job-map-detail", kwargs={"project": test_repository.name, "pk": pk})
    )
    assert resp.status_code == 200

    expected = {
        "job_id": job.id,
        "bug_id": bug.id,
        "created": bjm.created.isoformat(),
        "who": test_user.email,
    }
    assert resp.json() == expected


@pytest.mark.parametrize('test_no_auth', [True, False])
def test_bug_job_map_delete(
    client, eleven_jobs_stored, test_repository, test_user, test_no_auth, bugs
):
    """
    test deleting a bug_job_map object
    """
    job = Job.objects.first()
    bug = bugs[0]

    BugJobMap.create(
        job_id=job.id, bug_id=bug.id, user=test_user,
    )

    if not test_no_auth:
        client.force_authenticate(user=test_user)

    pk = "{0}-{1}".format(job.id, bug.id)

    resp = client.delete(
        reverse("bug-job-map-detail", kwargs={"project": test_repository.name, "pk": pk})
    )

    if test_no_auth:
        assert resp.status_code == 403
        assert BugJobMap.objects.count() == 1
    else:
        content = json.loads(resp.content)
        assert content == {"message": "Bug job map deleted"}
        assert BugJobMap.objects.count() == 0


def test_bug_job_map_bad_job_id(client, test_repository):
    """
    test we have graceful error when we pass an invalid job_id
    """
    bad_job_id = "aaaa"

    resp = client.get(
        reverse("bug-job-map-list", kwargs={"project": test_repository.name}),
        data={'job_id': bad_job_id},
    )

    assert resp.status_code == 400
    assert resp.json() == {'message': 'Valid job_id required'}
