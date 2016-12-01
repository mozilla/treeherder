import pytest
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from taskcluster.sync import Auth

from treeherder.auth.backends import TaskclusterAuthBackend


@pytest.mark.django_db
@pytest.mark.parametrize(('username', 'email', 'user', 'exp_exception'), [
    ('dude', 'dude@lebowski.net', {"username": "dude", "email": "dude@lebowski.net"}, False),
    ('thneed', 'dude@lebowski.net', {"username": "dude", "email": "dude@lebowski.net"}, False),
    ('thneed', 'dood@lebowski.net', {"username": "dude", "email": "dude@lebowski.net"}, True)])
def test_get_user(username, email, user, exp_exception):
    test_user = User.objects.create(**user)
    # create a user with duplicate email
    User.objects.create(username="fleh", email=user["email"])

    tca = TaskclusterAuthBackend()
    if exp_exception:
        with pytest.raises(ObjectDoesNotExist):
            tca._get_user(email)
    else:
        found_user = tca._get_user(email)
        assert test_user == found_user


@pytest.mark.parametrize(('result', 'exp_email'),
                         [({'scopes': ['assume:mozilla-user:biped@mozilla.com',
                                       'assume:mozillians-user:biped'],
                            'clientId': 'mozilla-ldap/biped@mozilla.com'},
                           'biped@mozilla.com'),
                          ({'scopes': ['assume:mozillians-user:biped'],
                            'clientId': 'mozilla-ldap/biped@mozilla.com'},
                           "biped@mozilla.com"),
                          # a Mozillians account without email in clientId
                          ({'scopes': ["assume:mozillians-user:dude",
                                       "assume:mozillians-unvouched",
                                       "auth:create-client:email/dude@lebowski.rug/*",
                                       "auth:delete-client:email/dude@lebowski.rug/*",
                                       "auth:update-client:email/dude@lebowski.rug/*",
                                       "auth:reset-access-token:email/dude@lebowski.rug/*"],
                            'clientId': 'email/duderino'},
                           "duderino"),
                          ])
def test_get_email(result, exp_email):
    tca = TaskclusterAuthBackend()
    email = tca._get_email_from_clientid(result["clientId"])
    assert email == exp_email


@pytest.mark.parametrize(('result', 'exp_username'),
                         [({'status': 'auth-success',
                            'scopes': ["assume:mozillians-user:user1",
                                       "assume:mozillians-unvouched"],
                            'clientId': 'email/user@foo.com'},
                          'email/user@foo.com'),
                          ({'status': 'auth-success',
                            'scopes': ["assume:mozillians-user:user1",
                                       "assume:mozillians-unvouched"],
                            'clientId': 'email/emailaddressexceeding30chars@foo.com'},
                          'email/emailaddressexceeding30chars@foo.com'),
                          ])
def test_existing_email_but_create_instead(test_user, monkeypatch, result,
                                           exp_username):
    """
    A user exists, but logged in with email only, so create a new user.

    If they log in with LDAP, and have the scope of mozilla-user, then we will
    match to an existing user and migrate their ``username``.  But if they log
    in with email only, even if the email address matches an existing user, but
    it doesn't have that scope, then only find the user with the exact same
    ``username`` which will be the ``clientId`` from the result.
    """
    def authenticateHawk_mock(selfless, obj):
        return result

    monkeypatch.setattr(Auth, "authenticateHawk", authenticateHawk_mock)
    tca = TaskclusterAuthBackend()
    new_user = tca.authenticate(auth_header="meh", host="fleh", port=3)
    assert new_user.username == exp_username


@pytest.mark.django_db
def test_get_user_raises():
    tca = TaskclusterAuthBackend()
    with pytest.raises(ObjectDoesNotExist):
        tca._get_user("merd@ferd.net")


@pytest.mark.django_db
def test_create_missing_user(monkeypatch):

    def authenticateHawk_mock(selfless, obj):
        return {'status': 'auth-success',
                'scopes': ['assume:mozilla-user:biped@mozilla.com',
                           'assume:project:treeherder:*'],
                'clientId': 'mozilla-ldap/boped@mozilla.com'}

    monkeypatch.setattr(Auth, "authenticateHawk", authenticateHawk_mock)
    tca = TaskclusterAuthBackend()
    new_user = tca.authenticate(auth_header="meh", host="fleh", port=3)
    assert new_user.email == "boped@mozilla.com"
