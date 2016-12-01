import base64
import hashlib
import logging
import re

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.reverse import reverse
from taskcluster.sync import Auth

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

    def _get_scope_value(self, scopes, scope_prefix):
        for scope in scopes:
            if scope.startswith(scope_prefix):
                return scope[len(scope_prefix):]
        return None

    def _get_email(self, result):
        """
        Get the user's email from the mozilla-user scope

        For more info on scopes:
        https://docs.taskcluster.net/manual/3rdparty#authenticating-with-scopes
        """
        # Try finding the email in the mozilla-user scope
        email = self._get_scope_value(result["scopes"], "assume:mozilla-user:")

        if email and re.search(r'.+@.+', email):
            return email
        else:
            # Try finding the email in the clientId.
            # Credit for regex to http://emailregex.com/ Python section
            match = re.search(
                r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
                result["clientId"])
            if match:
                return match.group(0)

        # If we get here, we couldn't find a valid email.  So deny login.
        raise TaskclusterAuthenticationFailed(
            "Unable to determine email for clientId: '{}'. Scope 'assume:mozilla-user': '{}'".format(
                result["clientId"], email))

    def _get_user(self, email):
        """
        Try to find an exising user that matches the email.

        TODO: Switch to using ``username`` instead of email once we are on
        Django 1.10 in Bug 1311967.  will need to migrate existing hashed
        usenames at that point.

        """

        # Since there is a unique index on username, but not on email,
        # it is POSSIBLE there could be two users with the same email and
        # different usernames.  Not very likely, but this is safer.
        user = User.objects.filter(email=email)

        # if we didn't find any, then raise an exception so we create a new
        # user
        if not user:
            raise ObjectDoesNotExist

        return user.first()

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
            raise TaskclusterAuthenticationFailed(result["message"])

        # TODO: remove this size limit when we upgrade to django 1.10
        # in Bug 1311967
        email = self._get_email(result)
        if len(email) <= 30:
            username = email
        else:
            username = base64.urlsafe_b64encode(
                hashlib.sha1(smart_bytes(email)).digest()
                ).rstrip(b'=')[-30:]

        try:
            # Find the user by their email.
            user = self._get_user(email)
            user.username = username

        except ObjectDoesNotExist:
            # the user doesn't already exist, create it.
            logger.warning("Creating new user: {}".format(username))
            user = User(email=email,
                        username=username,
                        )

        user.save()
        return user

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class TaskclusterAuthenticationFailed(Exception):
    pass
