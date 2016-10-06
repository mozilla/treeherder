import logging
import re
from hashlib import sha1

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from taskcluster.sync import Auth
from taskcluster.utils import scope_match

logger = logging.getLogger(__name__)


class TaskclusterAuthBackend(object):
    """
        result of tc_auth.authenticateHawk has the form:

        {'status': 'auth-success',
         'scopes': ['assume:mozilla-group:ateam',
                    'assume:mozilla-group:vpn_treeherder',
                    'assume:mozilla-user:cdawson@mozilla.com',
                    'assume:mozillians-user:camd',
                    ...
                    'assume:project-admin:ateam',
                    'assume:project-admin:treeherder',
                    'assume:project:ateam:*',
                    'assume:project:treeherder:*',
                    'assume:worker-id:*',
                    'secrets:set:project/treeherder/*'],
         'scheme': 'hawk',
         'clientId': 'mozilla-ldap/cdawson@mozilla.com',
         'expires': '2016-10-31T17:40:45.692Z'}
    """

    def _get_scope_value(self, result, scope_prefix):
        for scope in result["scopes"]:
            if scope.startswith(scope_prefix):
                return scope[len(scope_prefix):]
        return None

    def _get_email(self, result):
        """
        Get the user's email from the mozilla-user scope

        If that scope is not present, then don't log the user in.  Cameron
        and Dustin decided this should be a hard requirement.
        See: https://docs.taskcluster.net/manual/3rdparty
        """
        email = self._get_scope_value(result, "assume:mozilla-user:")

        # try finding the email in the clientId.  Doesn't give them permissions
        # of any type, but can be used to find a matching user.
        if not email or email == "*":
            match = re.search(r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)", result["clientId"])
            if match:
                email = match.group(0)
            else:
                # if we STILL don't have an email at this point, then just
                # use a dummy email.  We don't use it for any authentication
                # or to send anything to it, so it doesn't matter much, in
                # reality.  But this should be very rare and won't happen
                # for sheriffs ever.
                email = "treeherderuser@treeherder.tree"
        return email

    def authenticate(self, authorization=None, host=None, port=None):
        user = None

        if authorization:
            tc_auth = Auth()
            result = tc_auth.authenticateHawk({
                "authorization": authorization,
                "host": host,
                "port": port,
                "resource": "/",
                "method": "get",
            })

            if result["status"] == "auth-success":
                is_sheriff = scope_match(
                    result["scopes"], [["assume:project:treeherder:sheriff"]])

                # TODO: remove this size limit when we upgrade to django 1.10
                # in Bug 1311967
                username = result["clientId"][-30:]
                email = self._get_email(result)

                try:
                    user = User.objects.get(username=username)
                except ObjectDoesNotExist:
                    # the user doesn't already exist, create it.
                    logger.warning("Creating new user: {}".format(username))
                    sha = sha1()
                    sha.update(email)
                    user = User(email=email,
                                username=username,
                                password=sha.hexdigest()[-25:]
                                )

                # User's sheriff status is no longer fetched from the DB.  Now
                # it is determined solely by having the correct scope.
                user.is_staff = is_sheriff
                # update their email if their scopes when the user was created
                # didn't allow finding the email, but now it's been fixed.
                user.email = email

                # update the user object in the DB (perhaps Sheriff status
                # or email changed.  This is so that when ``get_user`` is
                # called, it will return the latest is_staff value we got from
                # LDAP.
                user.save()
        return user

    def get_user(self, user_id):
        try:
            return User._default_manager.get(pk=user_id)
        except User.DoesNotExist:
            return None


class TaskclusterAuthenticationFailed(Exception):
    pass
