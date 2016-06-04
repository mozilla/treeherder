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
        assert requestdata['description'] == "Filed by: {}\n\nIntermittent Description".format(test_user.username)
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
    client.force_authenticate(user=test_user)

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


def test_get_api_root(webapp, eleven_jobs_stored, activate_responses, test_user):
    """
    test returning the bugzilla api root
    """

    client = APIClient()

    resp = client.get(
        reverse("bugzilla-get-api-root")
    )

    content = json.loads(resp.content)
    assert content['api_root'] == "https://thisisnotbugzilla.org"
