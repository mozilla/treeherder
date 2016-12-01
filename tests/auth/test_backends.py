import pytest
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from taskcluster.sync import Auth

from treeherder.auth.backends import (TaskclusterAuthBackend,
                                      TaskclusterAuthenticationFailed)


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


@pytest.mark.parametrize(('result', 'exp_email', 'exp_exception'),
                         [({'scopes': ['assume:mozilla-user:biped@mozilla.com',
                                       'assume:mozillians-user:biped'],
                            'clientId': 'mozilla-ldap/biped@mozilla.com'},
                           'biped@mozilla.com',
                           False),
                          ({'scopes': ['assume:mozillians-user:biped'],
                            'clientId': 'mozilla-ldap/biped@mozilla.com'},
                           "biped@mozilla.com",
                           False),
                          # a Mozillians account without email in clientId
                          ({'scopes': ["assume:mozillians-user:dude",
                                       "assume:mozillians-unvouched",
                                       "auth:create-client:email/dude@lebowski.rug/*",
                                       "auth:delete-client:email/dude@lebowski.rug/*",
                                       "auth:update-client:email/dude@lebowski.rug/*",
                                       "auth:reset-access-token:email/dude@lebowski.rug/*"],
                            'clientId': 'email/duderino'},
                           None,
                           True),
                          ])
def test_get_email(result, exp_email, exp_exception):
    tca = TaskclusterAuthBackend()
    if exp_exception:
        with pytest.raises(TaskclusterAuthenticationFailed):
            tca._get_email(result)
    else:
        email = tca._get_email(result)
        assert email == exp_email


@pytest.mark.django_db
def test_create_missing_user(monkeypatch):

    def authenticateHawk_mock(selfless, obj):
        return {'status': 'auth-success',
                'scopes': ['assume:mozilla-user:biped@mozilla.com',
                           'assume:project:treeherder:*'],
                'clientId': 'mozilla-ldap/biped@mozilla.com'}

    monkeypatch.setattr(Auth, "authenticateHawk", authenticateHawk_mock)
    tca = TaskclusterAuthBackend()
    new_user = tca.authenticate(auth_header="meh", host="fleh", port=3)
    assert new_user.email == "biped@mozilla.com"
