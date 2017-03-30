import requests
from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import list_route
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.etl.common import make_request


class BugzillaViewSet(viewsets.ViewSet):

    @list_route(methods=['post'])
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """
        if settings.BZ_API_KEY is None:
            return Response({"failure": "Bugzilla API key not defined. This shouldn't happen."},
                            status=HTTP_400_BAD_REQUEST)

        params = request.data
        description = "Filed by: {}\n\n{}".format(
            request.user.email.replace('@', " [at] "),
            params.get("comment", "")
        )
        url = settings.BZ_API_URL + "/rest/bug"
        headers = {
            'x-bugzilla-api-key': settings.BZ_API_KEY,
            'Accept': 'application/json'
        }
        data = {
            'product': params.get("product"),
            'component': params.get("component"),
            'summary': params.get("summary"),
            'keywords': params.get("keywords"),
            'blocks': params.get("blocks"),
            'depends_on': params.get("depends_on"),
            'see_also': params.get("see_also"),
            'version': params.get("version"),
            'cf_crash_signature': params.get("crash_signature"),
            'severity': params.get("severity"),
            'description': description,
            'comment_tags': "treeherder",
        }

        try:
            response = make_request(url, method='POST', headers=headers, json=data)
        except requests.exceptions.HTTPError as e:
            try:
                message = e.response.json()['message']
            except (ValueError, KeyError):
                message = e.response.text
            return Response({"failure": message}, status=HTTP_400_BAD_REQUEST)

        return Response({"success": response.json()["id"]})
