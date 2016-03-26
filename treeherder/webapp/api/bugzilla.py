import requests
from django.conf import settings
from rest_framework import (status,
                            viewsets)
from rest_framework.decorators import list_route
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.etl.common import make_request


class BugzillaViewSet(viewsets.ViewSet):
    # permission_classes = (IsAuthenticatedOrReadOnly,)

    @list_route(methods=['post'])
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """

        if settings.BZ_API_KEY is None:
            return Response({"failure": "Bugzilla API key not defined. This shouldn't happen."},status=status.HTTP_400_BAD_REQUEST)
        else:
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
              return Response({"failure": response.json()['message'], "headers": headers, "settings": settings.BZ_API_KEY, "url": settings.BZ_API_URL}, status=status.HTTP_400_BAD_REQUEST)

          return Response({"success": response.json()["id"]})
