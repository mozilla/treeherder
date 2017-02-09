import logging
import re

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.reverse import reverse
from taskcluster.sync import Auth
from taskcluster.utils import scope_match

try:
    from django.utils.encoding import smart_bytes
except ImportError:
    from django.utils.encoding import smart_str as smart_bytes

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

    def _find_user_by_email(self, email, username, scopes):
        """
        Try to find an existing user that matches the email.
        """

        if scope_match(scopes, [["assume:mozilla-user:{}".format(email)]]):
            # Find the user by their email.

            # Since there is a unique index on username, but not on email,
            # it is POSSIBLE there could be two users with the same email and
            # different usernames.  Not very likely, but this is safer.
            users = User.objects.filter(email=email)

            # update the username
            if users:
                user = users.first()
                user.username = username
                user.save()
                return user

        # if we didn't find any, or the user doesn't have the proper scope,
        # then raise an exception so we create a new user
        raise ObjectDoesNotExist

    def authenticate(self, auth_header=None, host=None, port=None):
        if not auth_header:
            # Doesn't have the right params for this backend.  So just
            # skip and let another backend have a try at it.
            return None

        tc_auth = Auth()
        # see: https://docs.taskcluster.net/reference/platform/auth/api-docs#authenticateHawk
        # see: https://github.com/taskcluster/taskcluster-client.py/blob/master/README.md#authenticate-hawk-request
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

        # Look for an existing user in this order:
        #
        # 1. Matching username/clientId
        # 2. Matching email.
        # Otherwise, create it, as long as it has an email.
        try:
            return User.objects.get(username=client_id)

        except ObjectDoesNotExist:
            try:
                # TODO: remove this once all users are converted to clientId
                # as username.  Bug 1337987.
                return self._find_user_by_email(email, client_id, result["scopes"])

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
