import logging

import newrelic.agent
from django.contrib.auth import authenticate, login, logout
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response

from treeherder.auth.backends import AuthError
from treeherder.webapp.api.serializers import UserSerializer

logger = logging.getLogger(__name__)


class AuthViewSet(viewsets.ViewSet):
    @action(detail=False)
    def login(self, request):
        """
        Verify credentials
        """
        try:
            user = authenticate(request)

            if not user:
                raise AuthenticationFailed("User not authenticated.")

            if not user.is_active:
                raise AuthenticationFailed("This user has been disabled.")

            login(request, user)

            return Response(UserSerializer(user).data)
        except AuthError as ex:
            # This indicates an error that may require attention by the
            # Treeherder or Taskcluster teams.  Logging this to New Relic to
            # increase visibility.
            newrelic.agent.record_exception()
            logger.exception("Error", exc_info=ex)
            raise AuthenticationFailed(str(ex))

    @action(detail=False)
    def logout(self, request):
        logout(request)
        return Response("User logged out")
