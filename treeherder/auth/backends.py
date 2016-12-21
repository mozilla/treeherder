import base64
import hashlib
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

    def _get_email(self, client_id):
        """
        Get the user's email from the mozilla-user scope

        For more info on scopes:
        https://docs.taskcluster.net/manual/3rdparty#authenticating-with-scopes
        """

        # Try finding the email in the clientId.
        # Credit for regex to http://emailregex.com/ Python section
        match = re.search(
            r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
            client_id)
        if match:
            return match.group(0)
        return ""

    def _get_user(self, email):
        """
        Try to find an existing user that matches the email.

        TODO: Switch to using ``username`` instead of email once we are on
        Django 1.10 in Bug 1311967.  will need to migrate existing hashed
        usernames at that point.

        """

        # Since there is a unique index on username, but not on email,
        # it is POSSIBLE there could be two users with the same email and
        # different usernames.  Not very likely, but this is safer.
        users = User.objects.filter(email=email)
        # if we didn't find any, then raise an exception so we create a new
        # user
        if not users:
            raise ObjectDoesNotExist

        return users.first()

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
            raise TaskclusterAuthenticationFailedException(result["message"])

        client_id = result["clientId"]
        email = self._get_email(client_id)
        # TODO: remove this size limit when we upgrade to django 1.10
        # in Bug 1311967
        if len(client_id) <= 30:
            username = client_id
        else:
            username = base64.urlsafe_b64encode(
                hashlib.sha1(smart_bytes(client_id)).digest()
                ).rstrip(b'=')[-30:]

        try:
            if scope_match(result["scopes"],
                           [["assume:mozilla-user:{}".format(email)]]):
                # Find the user by their email.
                user = self._get_user(email)
                # update the username
                user.username = username
                user.save()
                return user

            else:
                # with transaction.atomic():
                return User.objects.get(username=username)

        except ObjectDoesNotExist:
            if email:
                # the user doesn't already exist, create it.
                logger.warning("Creating new user: {}".format(username))
                user = User.objects.create_user(email=email,
                                                username=username)
                user.save()
                return user
            raise NoEmailException("No email in clientId.  Email required.")

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class TaskclusterAuthenticationFailedException(Exception):
    pass


class NoEmailException(Exception):
    pass
