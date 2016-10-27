import logging
from hashlib import sha1

import newrelic.agent
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from taskcluster.sync import Auth

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

    def list(self, request):
        """
        Verify credentials with Taskcluster

        result of tc_auth.authenticateHawk has the form:
            {
                'status': 'auth-success',
                'scopes': [...],
                'scheme': 'hawk',
                'clientId': 'mozilla-ldap/dlebowski@mozilla.com',
                'expires': '2016-10-23T21:17:20.726Z'
            }

        """
        authorization = request.META.get("HTTP_OTH", None)
        tc_auth = Auth()
        result = tc_auth.authenticateHawk({
            "host": "localhost",
            "port": 8080,
            "resource": "/",
            "method": "get",
            "authorization": authorization
        })

        if result["status"] == "auth-success":
            username = result["clientId"][-30:]
            email = result["clientId"].split("/")[1]

            user = User.objects.filter(
                Q(email=email) | Q(username=username)).first()

            if not user:
                # the user doesn't already exist, create it.
                logger.warning("Creating new user: {}".format(email))
                sha = sha1()
                sha.update(email)
                user = User(email=email,
                            username=username,
                            password=sha.hexdigest()[25:]
                            )
                user.save()

            authenticated = authenticate(remote_user=user.username)
            login(request, authenticated)

            return Response({
                "message": "login success",
                "result": str(result),
                "user": {"email": user.email,
                         "isSheriff": user.is_staff}
            })
        else:
            return Response({"message": "login failed",
                             "result": str(result)})
