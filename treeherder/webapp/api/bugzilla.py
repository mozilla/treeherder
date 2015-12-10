from time import time

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.derived.jobs import JobDataIntegrityError
from treeherder.webapp.api.utils import (UrlQueryFilter,
                                         with_jobs)
from rest_framework.decorators import (detail_route,
                                       list_route)


class BugzillaViewSet(viewsets.ViewSet):
    # permission_classes = (IsAuthenticatedOrReadOnly,)

    @list_route(methods=['post'])
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """

        params = request.data



        return Response({"message": "'Status' variable is: " + params["Status"]})
