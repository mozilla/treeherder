# coding: utf-8

import json

import responses
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient


def test_create_bug(webapp, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        print requestdata
        print requestheaders
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"Filed by: {}\n\nIntermittent Description".format(test_user.email.replace('@', " [at] "))
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure"]
        resp_body = {"id": 323}
        return(200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST, "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback, match_querystring=False,
        content_type="application/json",
    )

    client = APIClient()
    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent summary",
            "version": "4.0.17",
            "comment": u"Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
        }
    )

    content = json.loads(resp.content)

    assert content['success'] == 323


def test_create_bug_with_unicode(webapp, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        print requestdata
        print requestheaders
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"Filed by: {}\n\nIntermittent “description” string".format(test_user.email.replace('@', " [at] "))
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent “summary”"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure"]
        resp_body = {"id": 323}
        return(200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST, "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback, match_querystring=False,
        content_type="application/json",
    )

    client = APIClient()
    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent “summary”",
            "version": "4.0.17",
            "comment": u"Intermittent “description” string",
            "comment_tags": "treeherder",
            "keywords": ["intermittent-failure"],
        }
    )

    content = json.loads(resp.content)

    assert content['success'] == 323


def test_create_crash_bug(webapp, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug with a crash signature in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"Filed by: {}\n\nIntermittent Description".format(test_user.email.replace('@', " [at] "))
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure", "crash"]
        assert requestdata['cf_crash_signature'] == "[@crashsig]"
        assert requestdata['severity'] == 'critical'
        assert requestdata['priority'] == 'P5'
        resp_body = {"id": 323}
        return(200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST, "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback, match_querystring=False,
        content_type="application/json",
    )

    client = APIClient()
    client.force_authenticate(user=test_user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "product": "Bugzilla",
            "component": "Administration",
            "summary": u"Intermittent summary",
            "version": "4.0.17",
            "comment": u"Intermittent Description",
            "comment_tags": "treeherder",
            "crash_signature": "[@crashsig]",
            "severity": "critical",
            "priority": "P5",
            "keywords": ["intermittent-failure", "crash"],
        }
    )

    content = json.loads(resp.content)

    print content
    assert content['success'] == 323


def test_create_unauthenticated_bug(webapp, eleven_jobs_stored, activate_responses):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        print requestdata
        print requestheaders
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"Filed by: MyName\n\nIntermittent Description"
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == u"Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == ["intermittent-failure"]
        assert requestdata['depends_on'] == "123"
        assert requestdata['blocks'] == "1234"
        assert requestdata['see_also'] == "12345"
        resp_body = {"id": 323}
        return(200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST, "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback, match_querystring=False,
        content_type="application/json",
    )

    client = APIClient()

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
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
        }
    )

    content = json.loads(resp.content)

    print content
    assert content['detail'] == "Authentication credentials were not provided."


def test_create_bug_with_long_crash_signature(webapp, eleven_jobs_stored, activate_responses, test_user):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        print requestdata
        print requestheaders
        assert requestheaders['x-bugzilla-api-key'] == "12345helloworld"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == u"Filed by: MyName\n\nIntermittent Description"
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
        return(200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST, "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback, match_querystring=False,
        content_type="application/json",
    )

    client = APIClient()
    client.force_authenticate(user=test_user)

    crashsig = 'x' * 2050
    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
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
        }
    )

    content = json.loads(resp.content)

    print content
    assert content['failure'] == "Crash signature can't be more than 2048 characters."
