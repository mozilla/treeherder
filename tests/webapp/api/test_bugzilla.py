import json

import responses
# from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient


def test_create_bug(webapp, eleven_jobs_stored, activate_responses):
    """
    test successfully creating a bug in bugzilla
    """

    def request_callback(request):
        headers = {}
        requestdata = json.loads(request.body)
        requestheaders = request.headers
        print requestdata
        print requestheaders
        assert requestheaders['X_BUGZILLA_API_KEY'] == "12345helloworld"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == "Filed by: MyName\n\nIntermittent Description"
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == "Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == "intermittent-failure"
        resp_body = {"id": 323}
        return(200, headers, json.dumps(resp_body))

    responses.add_callback(
        responses.POST, "https://thisisnotbugzilla.org/rest/bug",
        callback=request_callback, match_querystring=False,
        content_type="application/json",
    )

    client = APIClient()
    user = User.objects.create(username="MyName", email="foo@bar.com")
    client.force_authenticate(user=user)

    resp = client.post(
        reverse("bugzilla-create-bug"),
        {
            "product": "Bugzilla",
            "component": "Administration",
            "summary": "Intermittent summary",
            "version": "4.0.17",
            "description": "Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": "intermittent-failure",
        }
    )

    user.delete()

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
        assert requestheaders['X_BUGZILLA_API_KEY'] == "12345helloworld"
        assert requestdata['product'] == "Bugzilla"
        assert requestdata['description'] == "Filed by: MyName\n\nIntermittent Description"
        assert requestdata['component'] == "Administration"
        assert requestdata['summary'] == "Intermittent summary"
        assert requestdata['comment_tags'] == "treeherder"
        assert requestdata['version'] == "4.0.17"
        assert requestdata['keywords'] == "intermittent-failure"
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
            "summary": "Intermittent summary",
            "version": "4.0.17",
            "description": "Intermittent Description",
            "comment_tags": "treeherder",
            "keywords": "intermittent-failure",
        }
    )

    content = json.loads(resp.content)

    print content
    assert content['detail'] == "Authentication credentials were not provided."
