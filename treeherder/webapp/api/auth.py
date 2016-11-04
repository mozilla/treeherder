import logging

import newrelic.agent
from django.contrib.auth import (authenticate,
                                 login,
                                 logout)
from rest_framework import viewsets
from rest_framework.decorators import list_route
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response

from treeherder.webapp.api.serializers import UserSerializer
from treeherder.credentials.models import Credentials

logger = logging.getLogger(__name__)


def hawk_lookup(id):
    try:
        newrelic.agent.add_custom_parameter("hawk_client_id", id)
        credentials = Credentials.objects.get(client_id=id, authorized=True)
    except Credentials.DoesNotExist:
        raise AuthenticationFailed('No authorised credentials found with id %s' % id)

    return {
        'id': id,
        'key': str(credentials.secret),
        'algorithm': 'sha256'
    }


class TaskclusterAuthViewSet(viewsets.ViewSet):

    @list_route(methods=['get'])
    def login(self, request):
        """
        Verify credentials with Taskcluster

        """
        authorization = request.META.get("HTTP_OTH", None)
        host = request.query_params.get("host", None)
        port = request.query_params.get("port", None)

        user = authenticate(authorization=authorization,
                            host=host,
                            port=int(port))
        login(request, user)

        return Response(UserSerializer(user).data)

    @list_route(methods=['get'])
    def logout(self, request):
        logout(request)
        return Response("User logged out")
