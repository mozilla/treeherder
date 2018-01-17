import time

import pytest
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.core.urlresolvers import reverse
from jose import jwt

from treeherder.auth.backends import (AuthBackend,
                                      NoEmailException)


@pytest.mark.parametrize(
    ('client_id', 'exp_email', 'exp_exception'),
    [('email/biped@mozilla.com', 'biped@mozilla.com', False),  # email clientId
     ('mozilla-ldap/biped@mozilla.com', "biped@mozilla.com", False),  # ldap clientId
     ('meh/duderino', None, True),  # invalid clientId, exception
     ('email/', None, True),  # invalid clientId, exception
     ('email/mozilla-ldap/foo@bar.com', None, True),  # invalid clientId, exception
     ('email/foo@bar.com <fakeness>', None, True),  # invalid clientId, exception
     ('meh/email/duderino@dude.net', None, True),  # invalid clientId, exception
     ])
def test_extract_email_from_clientid(client_id, exp_email, exp_exception):
    tca = AuthBackend()
    if exp_exception:
        with pytest.raises(NoEmailException):
            tca._extract_email_from_clientid(client_id)
    else:
        email = tca._extract_email_from_clientid(client_id)
        assert email == exp_email


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
def test_existing_email_create_user(test_user, webapp, monkeypatch, exp_username, email, exp_create_user):
    """
    Test whether a user was created or not, despite an existing user with
    a matching email.

    If they log in with email only, then only return an existing user on an exact
    ``username`` == ``clientId``.  Otherwise, create a new user with that
    username.
    """
    monkeypatch.setattr(jwt, "get_unverified_header", lambda x: {"kid": "skip_jwt_decode_section"})

    one_hour = 1000 * 60 * 60
    expires_at = int(round(time.time() * 1000)) + one_hour

    existing_user = User.objects.create(username="email/foo@bar.net", email=email)

    webapp.get(reverse("auth-login"), headers={"authorization": "Bearer meh", "expiresAt": str(expires_at), "clientId": exp_username})

    session_key = webapp.cookies["sessionid"]
    session = Session.objects.get(session_key=session_key)
    session_data = session.get_decoded()

    new_user = User.objects.get(id=session_data.get('_auth_user_id'))

    assert new_user.username == exp_username
    if exp_create_user:
        assert new_user.id != existing_user.id
    else:
        assert new_user.id == existing_user.id
