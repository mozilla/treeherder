import pytest
from django.contrib.auth.models import User
from taskcluster import Auth

from treeherder.auth.backends import (NoEmailException,
                                      TaskclusterAuthBackend)


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
    tca = TaskclusterAuthBackend()
    if exp_exception:
        with pytest.raises(NoEmailException):
            tca._extract_email_from_clientid(client_id)
    else:
        email = tca._extract_email_from_clientid(client_id)
        assert email == exp_email


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('result', 'exp_username', 'email', 'exp_create_user'),
    [({'status': 'auth-success',
       'scopes': [],
       'clientId': 'email/user@foo.com'},
      'email/user@foo.com',
      'user@foo.com',
      True),
     ({'status': 'auth-success',
       'scopes': [],
       'clientId': 'email/emailaddressexceeding30chars@foo.com'},
      'email/emailaddressexceeding30chars@foo.com',
      'emailaddressexceeding30chars@foo.com',
      True),
     ({'status': 'auth-success',
       'scopes': ["assume:mozilla-user:foo@bar.net"],
       'clientId': 'email/foo@bar.net'},
      'email/foo@bar.net',
      'foo@bar.net',
      False),
     ])
def test_existing_email_create_user(test_user, monkeypatch, result,
                                    exp_username, email, exp_create_user):
    """
    Test whether a user was created or not, despite an existing user with
    a matching email.

    If they log in with LDAP, and have the scope of mozilla-user, then we will
    match to an existing user and migrate their ``username``.  But if they log
    in with email only, then only return an existing user on an exact
    ``username`` == ``clientId``.  Otherwise, create a new user with that
    username.
    """
    def authenticateHawk_mock(selfless, obj):
        return result
    monkeypatch.setattr(Auth, "authenticateHawk", authenticateHawk_mock)

    existing_user = User.objects.create(username="mee", email=email)

    tca = TaskclusterAuthBackend()
    new_user = tca.authenticate(auth_header="meh", host="fleh", port=3)
    assert new_user.username == exp_username
    if exp_create_user:
        assert new_user.id != existing_user.id
    else:
        assert new_user.id == existing_user.id
