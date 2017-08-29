import logging
import re

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.reverse import reverse
from taskcluster import Auth

logger = logging.getLogger(__name__)

CLIENT_ID_RE = re.compile(
    r"^(?:email|mozilla-ldap)/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.["
    r"a-zA-Z0-9-.]+)$")


class TaskclusterAuthBackend(object):
    """
        result of tc_auth.authenticateHawk has the form:

        {'status': 'auth-success',
         'scopes': ['assume:mozilla-group:ateam',
                    'assume:mozilla-group:vpn_treeherder',
                    'assume:mozilla-user:biped@mozilla.com',
                    'assume:mozillians-user:biped',
                    ...
                    'assume:project-admin:ateam',
                    'assume:project-admin:treeherder',
                    'assume:project:ateam:*',
                    'assume:project:treeherder:*',
                    'assume:worker-id:*',
                    'secrets:set:project/treeherder/*'],
         'scheme': 'hawk',
         'clientId': 'mozilla-ldap/biped@mozilla.com',
         'expires': '2016-10-31T17:40:45.692Z'}
    """

    def _extract_email_from_clientid(self, client_id):
        """
        Extract the user's email from the client_id
        """

        # Client IDs must be in one of these forms:
        # - email/foo@bar.com
        # - mozilla-ldap/foo@bar.com
        # Email regex taken from http://emailregex.com
        match = CLIENT_ID_RE.match(client_id)
        if match:
            return match.group(1)

        raise NoEmailException(
            "No email found in clientId: '{}'".format(client_id))

    def authenticate(self, request):

        auth_header = request.META.get("HTTP_TCAUTH", None)
        host = request.get_host().split(":")[0]
        port = int(request.get_port())

        if not auth_header:
            # Doesn't have the right params for this backend.  So just
            # skip and let another backend have a try at it.
            return None

        tc_auth = Auth()
        # https://docs.taskcluster.net/reference/platform/taskcluster-auth/references/api#authenticateHawk
        # https://github.com/taskcluster/taskcluster-client.py#authenticate-hawk-request
        result = tc_auth.authenticateHawk({
            "authorization": auth_header,
            "host": host,
            "port": port,
            "resource": reverse("auth-login"),
            "method": "get",
        })

        if result["status"] != "auth-success":
            logger.warning("Error logging in: {}".format(result["message"]))
            raise TaskclusterAuthException(result["message"])

        client_id = result["clientId"]
        email = self._extract_email_from_clientid(client_id)

        # Look for an existing user by username/clientId
        # If not found, create it, as long as it has an email.
        try:
            return User.objects.get(username=client_id)

        except ObjectDoesNotExist:
            # the user doesn't already exist, create it.
            logger.warning("Creating new user: {}".format(client_id))
            return User.objects.create_user(client_id, email=email)

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class TaskclusterAuthException(Exception):
    pass


class NoEmailException(Exception):
    pass
