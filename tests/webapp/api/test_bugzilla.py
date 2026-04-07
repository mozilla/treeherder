import json

import responses
from django.urls import reverse


def test_create_bug(client, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders["x-bugzilla-api-key"] == "12345helloworld"
        assert requestdata["type"] == "defect"
        assert requestdata["product"] == "Bugzilla"
        assert requestdata["description"] == "**Filed by:** {}\nIntermittent Description".format(
            test_user.email.replace("@", " [at] ")
        )
        assert requestdata["component"] == "Administration"
        assert requestdata["summary"] == "Intermittent summary"
        assert requestdata["comment_tags"] == "treeherder"
        assert requestdata["version"] == "4.0.17"
        assert requestdata["keywords"] == ["intermittent-failure"]
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": "Intermittent summary",
            "version": "4.0.17",
            "comment": "Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
            "is_security_issue": False,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == 323
    assert resp.json()["url"] == "https://thisisnotbugzilla.org/show_bug.cgi?id=323"


def test_create_bug_with_unicode(client, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders["x-bugzilla-api-key"] == "12345helloworld"
        assert requestdata["type"] == "defect"
        assert requestdata["product"] == "Bugzilla"
        assert requestdata[
            "description"
        ] == "**Filed by:** {}\nIntermittent “description” string".format(
            test_user.email.replace("@", " [at] ")
        )
        assert requestdata["component"] == "Administration"
        assert requestdata["summary"] == "Intermittent “summary”"
        assert requestdata["comment_tags"] == "treeherder"
        assert requestdata["version"] == "4.0.17"
        assert requestdata["keywords"] == ["intermittent-failure"]
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": "Intermittent “summary”",
            "version": "4.0.17",
            "comment": "Intermittent “description” string",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
            "is_security_issue": False,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == 323


def test_create_crash_bug(client, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug with a crash signature in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders["x-bugzilla-api-key"] == "12345helloworld"
        assert requestdata["type"] == "defect"
        assert requestdata["product"] == "Bugzilla"
        assert requestdata["description"] == "**Filed by:** {}\nIntermittent Description".format(
            test_user.email.replace("@", " [at] ")
        )
        assert requestdata["component"] == "Administration"
        assert requestdata["summary"] == "Intermittent summary"
        assert requestdata["comment_tags"] == "treeherder"
        assert requestdata["version"] == "4.0.17"
        assert requestdata["keywords"] == ["intermittent-failure", "crash"]
        assert requestdata["cf_crash_signature"] == "[@crashsig]"
        assert requestdata["priority"] == "--"
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": "Intermittent summary",
            "version": "4.0.17",
            "comment": "Intermittent Description",
            "comment_tags": "treeherder",
            "crash_signature": "[@crashsig]",
            "priority": "--",
            "keywords": ["intermittent-failure", "crash"],
            "is_security_issue": False,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == 323


def test_create_unauthenticated_bug(client, eleven_jobs_stored, activate_responses):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders["x-bugzilla-api-key"] == "12345helloworld"
        assert requestdata["type"] == "defect"
        assert requestdata["product"] == "Bugzilla"
        assert requestdata["description"] == "**Filed by:** MyName\nIntermittent Description"
        assert requestdata["component"] == "Administration"
        assert requestdata["summary"] == "Intermittent summary"
        assert requestdata["comment_tags"] == "treeherder"
        assert requestdata["version"] == "4.0.17"
        assert requestdata["keywords"] == ["intermittent-failure"]
        assert requestdata["see_also"] == "12345"
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        content_type="application/json",
    )

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": "Intermittent summary",
            "version": "4.0.17",
            "comment": "Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
            "see_also": "12345",
            "is_security_issue": False,
        },
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Authentication credentials were not provided."


def test_post_comment(client, activate_responses, test_user):
    """
    test successfully posting a comment to a Bugzilla bug
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders["x-bugzilla-api-key"] == "12345helloworld"
        assert requestdata["comment"] == "Performance improvement detected."
        assert requestdata["comment_tags"] == ["perf-alert"]
        resp_body = {"id": 101}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug/323/comment",
        callback=request_callback,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-post-comment"),
        {"bug_id": 323, "comment": "Performance improvement detected."},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == 101


def test_post_comment_missing_bug_id(client, activate_responses, test_user):
    """
    test that post_comment returns 400 when bug_id is missing
    """
    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-post-comment"),
        {"comment": "Performance improvement detected."},
    )
    assert resp.status_code == 400
    assert resp.json()["failure"] == "bug_id is required"


def test_post_comment_missing_comment(client, activate_responses, test_user):
    """
    test that post_comment returns 400 when comment is missing
    """
    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-post-comment"),
        {"bug_id": 323},
    )
    assert resp.status_code == 400
    assert resp.json()["failure"] == "comment is required"


def test_post_comment_unauthenticated(client, activate_responses):
    """
    test that post_comment requires authentication
    """
    resp = client.post(
        reverse("bugzilla-post-comment"),
        {"bug_id": 323, "comment": "Performance improvement detected."},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Authentication credentials were not provided."


def test_create_bug_with_long_crash_signature(
    client, eleven_jobs_stored, activate_responses, test_user
):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders["x-bugzilla-api-key"] == "12345helloworld"
        assert requestdata["type"] == "defect"
        assert requestdata["product"] == "Bugzilla"
        assert requestdata["description"] == "**Filed by:** MyName\nIntermittent Description"
        assert requestdata["component"] == "Administration"
        assert requestdata["summary"] == "Intermittent summary"
        assert requestdata["comment_tags"] == "treeherder"
        assert requestdata["version"] == "4.0.17"
        assert requestdata["keywords"] == ["intermittent-failure", "regression"]
        assert requestdata["cf_crash_signature"] == "[@crashsig]"
        assert requestdata["regressed_by"] == "123"
        assert requestdata["see_also"] == "12345"
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    crashsig = "x" * 2050
    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": "Intermittent summary",
            "version": "4.0.17",
            "comment": "Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure", "regression"],
            "crash_signature": crashsig,
            "regressed_by": "123",
            "see_also": "12345",
            "is_security_issue": False,
        },
    )
    assert resp.status_code == 400
    assert resp.json()["failure"] == "Crash signature can't be more than 2048 characters."
