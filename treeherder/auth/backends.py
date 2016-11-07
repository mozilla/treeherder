import logging
import re
from hashlib import sha1

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q
from taskcluster.sync import Auth
from taskcluster.utils import scope_match

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

    def _get_scope_value(self, result, scope_prefix):
        for scope in result["scopes"]:
            if scope.startswith(scope_prefix):
                return scope[len(scope_prefix):]
        return None

    def _get_email(self, result):
        """
        Get the user's email from the mozilla-user scope

        """
        email = self._get_scope_value(result, "assume:mozilla-user:")

        if not email or email == "*":
            # try finding the email in the clientId.  It can then be used to
            # find a matching user.
            match = re.search(
                r"([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)",
                result["clientId"])
            if match:
                email = match.group(0)
            else:
                # if we STILL don't have an email at this point, then just
                # use their clientId as a dummy email.  We don't
                # send anything to it, so it doesn't matter much, in
                # reality.  This can only happen if the user isn't using LDAP,
                # and doesn't have an email in their clientId.
                email = result["clientId"]
        return email

    def _get_user(self, username, email):
        """
        Try to find an exising user that matches either the username
        or email.  Prefer the username, since that's the unique key.  But
        fallback to the email.

        """

        # Since there is a unique index on username, but not on email,
        # it is POSSIBLE there could be two users with the same email and
        # different usernames.  Not very likely, but this is safer.
        user = User.objects.filter(
            Q(username=username) | Q(email=email))

        # if we didn't find either, then raise an exception so we create a new
        # user
        if not len(user):
            raise ObjectDoesNotExist

        # prefer a matching username.  If no username match, return the first
        # user in the list.
        try:
            return user.get(username=username)
        except ObjectDoesNotExist:
            return user.first()


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
                # TODO: remove this size limit when we upgrade to django 1.10
                # in Bug 1311967
                username = result["clientId"][-30:]
                email = self._get_email(result)

                try:
                    # Either find the user by their username or email.
                    user = self._get_user(username, email)

                except ObjectDoesNotExist:
                    # the user doesn't already exist, create it.
                    logger.warning("Creating new user: {}".format(username))
                    sha = sha1()
                    sha.update(email)
                    is_staff = scope_match(
                        result["scopes"],
                        [["assume:project:treeherder:sheriff"]]
                    )
                    user = User(email=email,
                                username=username,
                                password=sha.hexdigest()[-25:],
                                is_staff=is_staff
                                )

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
