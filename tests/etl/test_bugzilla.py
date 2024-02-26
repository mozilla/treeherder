import pytest

from django.urls import reverse

from treeherder.etl.bugzilla import BzApiBugProcess
from treeherder.model.models import Bugscache


@pytest.mark.django_db(transaction=True)
def test_bz_api_process(mock_bugzilla_api_request):
    process = BzApiBugProcess()
    process.run()

    # the number of rows inserted should equal to the number of bugs
    assert Bugscache.objects.count() == 28

    # test that a second ingestion of the same bugs doesn't insert new rows
    process.run()
    assert Bugscache.objects.count() == 28


def test_bz_reopen_bugs(request, mock_bugzilla_reopen_request, client, test_job, test_user, bugs):
    """
    Test expected bugs get reopened.
    """
    bug = bugs[0]
    client.force_authenticate(user=test_user)

    incomplete_bugs = [bug for bug in bugs if bug.resolution == "INCOMPLETE"]
    not_incomplete_bugs = [bug for bug in bugs if bug.resolution != "INCOMPLETE"]
    for bug in [
        not_incomplete_bugs[0],
        not_incomplete_bugs[2],
        incomplete_bugs[0],
        incomplete_bugs[2],
    ]:
        submit_obj = {"job_id": test_job.id, "bug_id": bug.id, "type": "manual"}

        client.post(
            reverse("bug-job-map-list", kwargs={"project": test_job.repository.name}),
            data=submit_obj,
        )

    process = BzApiBugProcess()
    process.run()

    reopened_bugs = request.config.cache.get("reopened_bugs", None)

    import json

    expected_reopen_attempts = {
        "https://thisisnotbugzilla.org/rest/bug/202": json.dumps(
            {
                "status": "REOPENED",
                "comment": {
                    "body": "New failure instance: https://treeherder.mozilla.org/logviewer?job_id=1&repo=mozilla-central"
                },
                "comment_tags": "treeherder",
            }
        ),
        "https://thisisnotbugzilla.org/rest/bug/404": json.dumps(
            {
                "status": "REOPENED",
                "comment": {
                    "body": "New failure instance: https://treeherder.mozilla.org/logviewer?job_id=1&repo=mozilla-central"
                },
                "comment_tags": "treeherder",
            }
        ),
    }
    assert reopened_bugs == expected_reopen_attempts
