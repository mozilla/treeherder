import requests
from django.conf import settings
from rest_framework import (status,
                            viewsets)
from rest_framework.decorators import list_route
from rest_framework.response import Response

from treeherder.etl.common import make_request


class BugzillaViewSet(viewsets.ViewSet):

    @list_route(methods=['post'])
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """

        params = request.data
        url = settings.BZ_API_URL + "/rest/bug"
        headers = {
            'X_BUGZILLA_API_KEY': settings.BZ_API_KEY
        }
        data = {
            'product': params["product"],
            'component': params["component"],
            'summary': params["summary"],
            'keywords': params["keywords"],
            'version': params["version"],
            'description': params["description"],
            'comment_tags': "treeherder",
            # XXX Should implement dependson, blocks, needinfo, and ccstring fields
        }

        try:
            response = make_request(url, method='POST', headers=headers, json=data)
        except requests.exceptions.HTTPError as e:
            response = e.response
            # logger.error("HTTPError %s submitting to %s: %s", response.status_code, url, response.text)
            # return Response({"failure": response}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"failure": response.json(), "headers": headers, "settings": settings.BUGZILLA_API_KEY}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"success": response.json()["id"]})
