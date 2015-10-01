from time import time

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.etl.common import make_request
from treeherder.model.derived.jobs import JobDataIntegrityError
from treeherder.webapp.api.utils import (UrlQueryFilter,
                                         with_jobs)
from rest_framework.decorators import (detail_route,
                                       list_route)

from django.conf import settings



class BugzillaViewSet(viewsets.ViewSet):
    # permission_classes = (IsAuthenticatedOrReadOnly,)

    @list_route(methods=['post'])
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """

        params = request.data
        url = "https://bugzilla-dev.allizom.org/rest/bug"
        headers = {
            'X_BUGZILLA_API_KEY': 'qF8lX6AyGjcZcmSV4tZTmy2F2PbBycQdB9lsp8cB'
        }

        data = {
            'product': params["product"],
            'component': params["component"],
            'summary': params["summary"],
            'keywords': 'intermittent-failure',
            # 'dependson': params[""],
            # 'blocks': params[""],
            'version': params["version"],
            'description': params["description"],
            'comment_tags': "treeherder",
            # 'ccstring': params[""],
        }

        try:
            response = make_request(url, method='POST', headers=headers, json=data)
        except request.exceptions.HTTPError as e:
            response = e.response
            # logger.error("HTTPError %s submitting to %s: %s", response.status_code, url, response.text)
            return Response({"failure": response})

        return Response({"message": "hello"})
