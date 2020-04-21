from django.urls import reverse


def test_pending_job_available(test_repository, pending_jobs_stored, client):
    resp = client.get(reverse("jobs-list", kwargs={"project": test_repository.name}))
    assert resp.status_code == 200
    jobs = resp.json()

    assert len(jobs['results']) == 1

    assert jobs['results'][0]['state'] == 'pending'


def test_running_job_available(test_repository, running_jobs_stored, client):
    resp = client.get(reverse("jobs-list", kwargs={"project": test_repository.name}))
    assert resp.status_code == 200
    jobs = resp.json()

    assert len(jobs['results']) == 1

    assert jobs['results'][0]['state'] == 'running'


def test_completed_job_available(test_repository, completed_jobs_stored, client):
    resp = client.get(reverse("jobs-list", kwargs={"project": test_repository.name}))
    assert resp.status_code == 200
    jobs = resp.json()

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'completed'


def test_pending_stored_to_running_loaded(
    test_repository, pending_jobs_stored, running_jobs_stored, client
):
    """
    tests a job transition from pending to running
    given a loaded pending job, if I store and load the same job with status running,
    the latter is shown in the jobs endpoint
    """
    resp = client.get(reverse("jobs-list", kwargs={"project": test_repository.name}))
    assert resp.status_code == 200
    jobs = resp.json()

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'running'


def test_finished_job_to_running(
    test_repository, completed_jobs_stored, running_jobs_stored, client
):
    """
    tests that a job finished cannot change state
    """
    resp = client.get(reverse("jobs-list", kwargs={"project": test_repository.name}))
    assert resp.status_code == 200
    jobs = resp.json()

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'completed'


def test_running_job_to_pending(test_repository, running_jobs_stored, pending_jobs_stored, client):
    """
    tests that a job transition from pending to running
    cannot happen
    """
    resp = client.get(reverse("jobs-list", kwargs={"project": test_repository.name}))
    assert resp.status_code == 200
    jobs = resp.json()

    assert len(jobs['results']) == 1
    assert jobs['results'][0]['state'] == 'running'
