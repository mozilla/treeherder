import time
from importlib import import_module

import pytest
from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from treeherder.auth.backends import (AuthBackend,
                                      AuthenticationFailed)

SessionStore = import_module(settings.SESSION_ENGINE).SessionStore


@pytest.mark.parametrize(
    ('user_info', 'exp_username', 'exp_exception'),
    [({'sub': 'email', 'email': 'biped@mozilla.com'}, 'email/biped@mozilla.com', False),  # email clientId
     ({'sub': 'ad|Mozilla-LDAP|biped', 'email': 'biped@mozilla.com'}, 'mozilla-ldap/biped@mozilla.com', False),  # ldap clientId
     ({'sub': 'github|0000', 'email': 'biped@gmail.com'}, 'github/biped@gmail.com', False),  # github clientId
     ({'sub': 'google-oauth2|0000', 'email': 'biped@mozilla.com'}, 'google/biped@mozilla.com', False),  # google clientId
     ({'sub': 'meh', 'email': 'biped@mozilla.com'}, 'None', True),  # invalid clientId, exception
     ])
def test_get_username_from_userinfo(user_info, exp_username, exp_exception):
    tca = AuthBackend()
    if exp_exception:
        with pytest.raises(AuthenticationFailed):
            tca._get_username_from_userinfo(user_info)
    else:
        username = tca._get_username_from_userinfo(user_info)

        assert username == exp_username


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('exp_username', 'email', 'exp_create_user'),
    [('email/user@foo.com',
      'user@foo.com',
      True),
     ('email/emailaddressexceeding30chars@foo.com',
      'emailaddressexceeding30chars@foo.com',
      True),
     ('email/foo@bar.net',
      'foo@bar.net',
      False),
     ])
def test_existing_email_create_user(test_user, client, monkeypatch, exp_username, email, exp_create_user):
    """
    Test whether a user was created or not, despite an existing user with
    a matching email.

    If they log in with email only, then only return an existing user on an exact
    ``username`` == ``clientId``.  Otherwise, create a new user with that
    username.
    """
    def userinfo_mock(selfless, request):
        return {'sub': 'email', 'email': email, 'exp': '500'}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    one_hour = 1000 * 60 * 60
    expires_at = int(round(time.time() * 1000)) + one_hour

    existing_user = User.objects.create(username="email/foo@bar.net", email=email)

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_IDTOKEN="meh",
        HTTP_EXPIRESAT=str(expires_at)
    )
    assert resp.status_code == 200

    session = client.session
    assert not session.is_empty()

    new_user = User.objects.get(id=session['_auth_user_id'])

    assert new_user.username == exp_username
    if exp_create_user:
        assert new_user.id != existing_user.id
    else:
        assert new_user.id == existing_user.id
