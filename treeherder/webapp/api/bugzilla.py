import requests
from django.conf import settings
from rest_framework import (status,
                            viewsets)
from rest_framework.decorators import list_route
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.etl.common import make_request


class BugzillaViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)

    @list_route(methods=['post'])
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """

        if settings.BZ_API_KEY is None:
            return Response({"failure": "Bugzilla API key not defined. This shouldn't happen."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            params = request.data
            url = settings.BZ_API_URL + "/rest/bug"
            headers = {
                'x-bugzilla-api-key': settings.BZ_API_KEY,
                'Accept': 'application/json'
            }
            data = {
                'product': params["product"],
                'component': params["component"],
                'summary': params["summary"],
                'keywords': params["keywords"],
                'version': params["version"],
                'description': "Filed by: " + request.user.username + "\n\n" + params["description"],
                'comment_tags': "treeherder",
            }

            try:
                response = make_request(url, method='POST', headers=headers, json=data)
            except requests.exceptions.HTTPError as e:
                response = e.response
                try:
                    rsperror = response.json()['message']
                except:
                    rsperror = response
                return Response({"failure": rsperror}, status=status.HTTP_400_BAD_REQUEST)

            return Response({"success": response.json()["id"]})

    @list_route(methods=['get'])
    def get_api_root(self, request):
        """
        Return the server's API root so the UI can use it
        """

        print "HELLO"
        if settings.BZ_API_URL is None:
            return Response({"failure": "Bugzilla API URL not defined. This shouldn't happen."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"api_root": settings.BZ_API_URL})
