import json
# import responses
# import re

# from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework.test import APIClient


def test_create_bug(webapp, eleven_jobs_stored):
    """
    test creating a bug in bugzilla
    """

    # def request_callback(request):
    #    headers = {}
    #    return(200, headers, {"success":"123456"})
    # url_re = re.compile(r'https://bugzilla-dev.allizom.org/.*')
    # responses.add_callback(
    #    responses.POST, url_re,
    #    callback=request_callback, content_type="application/json",
    # )
    # responses.add(
    #    responses.POST, url_re,
    #    body='{"success":"123456"}', status=200, content_type="application/json",
    # )

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

    assert content['success']
