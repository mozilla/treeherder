import logging

import newrelic.agent
from django.contrib.auth import (authenticate,
                                 login,
                                 logout)
from rest_framework import viewsets
from rest_framework.decorators import list_route
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from taskcluster.exceptions import (TaskclusterConnectionError,
                                    TaskclusterRestFailure)

from treeherder.auth.backends import TaskclusterAuthenticationFailed
from treeherder.credentials.models import Credentials
from treeherder.webapp.api.serializers import UserSerializer

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

    @list_route()
    def login(self, request):
        """
        Verify credentials with Taskcluster
        """
        auth_header = request.META.get("HTTP_TCAUTH", None)
        host = request.get_host().split(":")[0]
        port = request.get_port()

        try:
            user = authenticate(auth_header=auth_header,
                                host=host,
                                port=int(port))
            if not user:
                raise AuthenticationFailed("User not authenticated.")

            if not user.is_active:
                raise AuthenticationFailed("This user has been disabled.")

            login(request, user)

            return Response(UserSerializer(user).data)
        except TaskclusterAuthenticationFailed as ex:
            # This is an error where the user wasn't able to log in
            # for some reason.
            logger.warning("Error authenticating with Taskcluster", exc_info=ex)
            raise AuthenticationFailed(ex.message)
        except (TaskclusterConnectionError,
                TaskclusterRestFailure) as ex:
            # This indicates an error that may require attention by the
            # Treeherder or Taskcluster teams.  Logging this to New Relic to
            # increase visibility.
            newrelic.agent.record_exception()
            logger.exception("Error communicating with Taskcluster", exc_info=ex)
            raise AuthenticationFailed(ex.message)

    @list_route()
    def logout(self, request):
        logout(request)
        return Response("User logged out")
