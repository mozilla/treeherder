# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
import base64
import hashlib
import logging

from django.conf import settings

try:
    from django.utils.encoding import smart_bytes
except ImportError:
    from django.utils.encoding import smart_str as smart_bytes

from django_browserid.base import get_audience, RemoteVerifier
from django_browserid.signals import user_created
from django_browserid.util import import_from_setting

try:
    from django.contrib.auth import get_user_model
except ImportError:
    from django.contrib.auth.models import User

    def get_user_model(*args, **kwargs):
        return User


logger = logging.getLogger(__name__)


def default_username_algo(email):
    # store the username as a base64 encoded sha1 of the email address
    # this protects against data leakage because usernames are often
    # treated as public identifiers (so we can't use the email address).
    return base64.urlsafe_b64encode(
        hashlib.sha1(smart_bytes(email)).digest()
    ).rstrip(b'=')


class BrowserIDBackend(object):
    supports_anonymous_user = False
    supports_inactive_user = True
    supports_object_permissions = False

    def __init__(self):
        # Store the current user model on creation to avoid issues if settings.AUTH_USER_MODEL
        # changes, which usually only happens during tests.
        self.User = get_user_model()

    def get_verifier(self):
        """
        Create a verifier for verifying assertions. Uses a
        :class:`django_browserid.base.RemoteVerifier` by default.
        """
        return RemoteVerifier()

    def filter_users_by_email(self, email):
        """Return all users matching the specified email."""
        return self.User.objects.filter(email=email)

    def create_user(self, email):
        """Return object for a newly created user account."""
        from django.db import IntegrityError  # Importing at the top causes issues on DB init.

        username_algo = getattr(settings, 'BROWSERID_USERNAME_ALGO', None)
        if username_algo is not None:
            username = username_algo(email)
        else:
            username = default_username_algo(email)

        try:
            return self.User.objects.create_user(username, email)
        except IntegrityError as err:
            # Race condition! Attempt to re-fetch from the database.
            logger.warning('IntegrityError during user creation: {0}'.format(err))

            try:
                return self.User.objects.get(email=email)
            except self.User.DoesNotExist:
                # Whatevs, let's re-raise the error.
                raise err

    def is_valid_email(self, email):
        """Return True if the email address is ok to log in."""
        # This method is basically for your overriding pleasures.
        return True

    def authenticate(self, assertion=None, audience=None, request=None, **kwargs):
        """
        Authenticate a user by verifying a BrowserID assertion. Defers to the verifier returned by
        :func:`BrowserIDBackend.get_verifier` for verification.

        You may either pass the ``request`` parameter to determine the audience from the request,
        or pass the ``audience`` parameter explicitly.

        :param assertion:
            Assertion submitted by the user. This asserts that the user controls a specific email
            address.

        :param audience:
            The audience to use when verifying the assertion; this prevents another site using
            an assertion for their site to login to yours. This value takes precedence over the
            audience pulled from the request parameter, if given.

        :param request:
            The request that generated this authentication attempt. This is used to determine the
            audience to use during verification, using the
            :func:`django_browserid.base.get_audience` function. If the audience parameter is also
            passed, it will be used instead of the audience from the request.

        :param kwargs:
            All remaining keyword arguments are passed to the ``verify`` function on the verifier.
        """
        if audience is None and request:
            audience = get_audience(request)

        if audience is None or assertion is None:
            return None

        verifier = self.get_verifier()
        result = verifier.verify(assertion, audience, **kwargs)
        if not result:
            return None

        email = result.email
        if not self.is_valid_email(email):
            return None

        # In the rare case that two user accounts have the same email address,
        # log and bail. Randomly selecting one seems really wrong.
        users = self.filter_users_by_email(email=email)
        if len(users) > 1:
            logger.warn('%s users with email address %s.', len(users), email)
            return None
        if len(users) == 1:
            return users[0]

        create_user = getattr(settings, 'BROWSERID_CREATE_USER', True)
        if not create_user:
            logger.debug('Login failed: No user with email %s found, and '
                         'BROWSERID_CREATE_USER is False', email)
            return None
        else:
            if create_user is True:
                create_function = self.create_user
            else:
                # Find the function to call.
                create_function = import_from_setting('BROWSERID_CREATE_USER')

            user = create_function(email)
            user_created.send(create_function, user=user)
            return user

    def get_user(self, user_id):
        try:
            user = self.User.objects.get(pk=user_id)
            return user
        except self.User.DoesNotExist:
            return None
