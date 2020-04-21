# coding: utf-8

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
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['type'] == "defect"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"**Filed by:** {}\nIntermittent Description".format(
            test_user.email.replace('@', " [at] ")
        )
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure"]
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        match_querystring=False,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent summary",
            "version": "4.0.17",
            "comment": u"Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()['success'] == 323


def test_create_bug_with_unicode(client, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['type'] == "defect"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata[
            'description'
        ] == u"**Filed by:** {}\nIntermittent “description” string".format(
            test_user.email.replace('@', " [at] ")
        )
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent “summary”"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure"]
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        match_querystring=False,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent “summary”",
            "version": "4.0.17",
            "comment": u"Intermittent “description” string",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()['success'] == 323


def test_create_crash_bug(client, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug with a crash signature in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['type'] == "defect"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"**Filed by:** {}\nIntermittent Description".format(
            test_user.email.replace('@', " [at] ")
        )
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure", "crash"]
        assert requestdata['cf_crash_signature'] == "[@crashsig]"
        assert requestdata['priority'] == '--'
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        match_querystring=False,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent summary",
            "version": "4.0.17",
            "comment": u"Intermittent Description",
            "comment_tags": "treeherder",
            "crash_signature": "[@crashsig]",
            "priority": "--",
            "keywords": ["intermittent-failure", "crash"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()['success'] == 323


def test_create_unauthenticated_bug(client, eleven_jobs_stored, activate_responses):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['type'] == "defect"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"**Filed by:** MyName\nIntermittent Description"
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure"]
        assert requestdata['depends_on'] == "123"
        assert requestdata['blocks'] == "1234"
        assert requestdata['see_also'] == "12345"
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        match_querystring=False,
        content_type="application/json",
    )

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent summary",
            "version": "4.0.17",
            "comment": u"Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
            "depends_on": "123",
            "blocks": "1234",
            "see_also": "12345",
        },
    )
    assert resp.status_code == 403
    assert resp.json()['detail'] == "Authentication credentials were not provided."


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
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['type'] == "defect"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"**Filed by:** MyName\nIntermittent Description"
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure"]
        assert requestdata['cf_crash_signature'] == "[@crashsig]"
        assert requestdata['depends_on'] == "123"
        assert requestdata['blocks'] == "1234"
        assert requestdata['see_also'] == "12345"
        resp_body = {"id": 323}
        return (200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST,
        "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback,
        match_querystring=False,
        content_type="application/json",
    )

    client.force_authenticate(user=test_user)

    crashsig = 'x' * 2050
    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "type": "defect",
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent summary",
            "version": "4.0.17",
            "comment": u"Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
            "crash_signature": crashsig,
            "depends_on": "123",
            "blocks": "1234",
            "see_also": "12345",
        },
    )
    assert resp.status_code == 400
    assert resp.json()['failure'] == "Crash signature can't be more than 2048 characters."
