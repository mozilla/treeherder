import pytest

from django.urls import reverse

from treeherder.etl.bugzilla import BzApiBugProcess
from treeherder.model.models import Bugscache, BugJobMap


@pytest.mark.django_db(transaction=True)
def test_bz_api_process(mock_bugzilla_api_request):
    process = BzApiBugProcess()
    process.run()

    # the number of rows inserted should equal to the number of bugs
    assert Bugscache.objects.count() == 28

    # test that a second ingestion of the same bugs doesn't insert new rows
    process.run()
    assert Bugscache.objects.count() == 28


@pytest.mark.parametrize(
    "minimum_failures_to_reopen",
    [1, 3],
)
def test_bz_reopen_bugs(
    request,
    mock_bugzilla_reopen_request,
    client,
    test_jobs,
    test_user,
    bugs,
    minimum_failures_to_reopen,
):
    """
    Test expected bugs get reopened.
    """
    client.force_authenticate(user=test_user)
    request.config.cache.set("reopened_bugs", {})

    incomplete_bugs = [bug for bug in bugs if bug.resolution == "INCOMPLETE"]
    not_incomplete_bugs = [bug for bug in bugs if bug.resolution != "INCOMPLETE"]
    idx = 0
    for bug in [
        incomplete_bugs[0],
        incomplete_bugs[2],
        incomplete_bugs[0],
        incomplete_bugs[2],
        incomplete_bugs[0],
        not_incomplete_bugs[0],
        not_incomplete_bugs[2],
    ]:
        submit_obj = {
            "job_id": test_jobs[idx].id,
            "bug_id": bug.id,
            "type": "manual",
            "bug_open": False,
        }

        client.post(
            reverse("bug-job-map-list", kwargs={"project": test_jobs[idx].repository.name}),
            data=submit_obj,
        )

        idx += 1
        if idx % 11 == 0:
            idx = 0

    # always closed
    # as we only reopen a single instance of a bug, we choose the most recent instance
    # since the reopen code queries and then `.order_by("-created")`
    bug_job_map = BugJobMap.objects.filter(job_id=test_jobs[4].id, bug_id=incomplete_bugs[0].id)[0]
    assert bug_job_map.bug_open is False

    bug_job_map = BugJobMap.objects.filter(job_id=test_jobs[3].id, bug_id=incomplete_bugs[2].id)[0]
    assert bug_job_map.bug_open is False

    process = BzApiBugProcess()
    process.minimum_failures_to_reopen = minimum_failures_to_reopen
    process.run()

    # reopens based on minimum_failures_to_reopen
    bug_job_map = BugJobMap.objects.filter(job_id=test_jobs[4].id, bug_id=incomplete_bugs[0].id)[0]
    assert bug_job_map.bug_open is True

    bug_job_map = BugJobMap.objects.filter(job_id=test_jobs[3].id, bug_id=incomplete_bugs[2].id)[0]
    if minimum_failures_to_reopen < 3:
        assert bug_job_map.bug_open is True
    else:
        assert bug_job_map.bug_open is False

    reopened_bugs = request.config.cache.get("reopened_bugs", None)

    import json

    expected_reopen_attempts = {
        "https://thisisnotbugzilla.org/rest/bug/202": json.dumps(
            {
                "status": "REOPENED",
                "comment": {
                    "body": "New failure instance: https://treeherder.mozilla.org/logviewer?job_id=5&repo=mozilla-central"
                },
                "comment_tags": "treeherder",
            },
        ),
    }

    if process.minimum_failures_to_reopen == 1:
        expected_reopen_attempts["https://thisisnotbugzilla.org/rest/bug/404"] = json.dumps(
            {
                "status": "REOPENED",
                "comment": {
                    "body": "New failure instance: https://treeherder.mozilla.org/logviewer?job_id=4&repo=mozilla-central"
                },
                "comment_tags": "treeherder",
            },
        )
    assert reopened_bugs == expected_reopen_attempts
