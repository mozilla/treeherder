import time
from importlib import import_module

import pytest
from django.conf import settings
from django.core.urlresolvers import reverse
from mohawk import Sender
from rest_framework import status
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from treeherder.auth.backends import AuthBackend
from treeherder.model.models import User
from treeherder.webapp.api import permissions

SessionStore = import_module(settings.SESSION_ENGINE).SessionStore


class AuthenticatedView(APIView):
    permission_classes = (permissions.HasHawkPermissionsOrReadOnly,)

    def get(self, request, *args, **kwargs):
        return Response({'foo': 'bar'})

    def post(self, request, *args, **kwargs):
        return Response({'foo': 'bar'})


factory = APIRequestFactory()
url = 'http://testserver/'


def _get_hawk_response(client_id, secret, method='GET',
                       content='', content_type='application/json'):
    auth = {
        'id': client_id,
        'key': secret,
        'algorithm': 'sha256'
    }
    sender = Sender(auth, url, method,
                    content=content,
                    content_type=content_type)

    do_request = getattr(factory, method.lower())
    request = do_request(url,
                         data=content,
                         content_type=content_type,
                         # factory.get doesn't set the CONTENT_TYPE header from
                         # `content_type` so the header has to be set manually.
                         CONTENT_TYPE=content_type,
                         HTTP_AUTHORIZATION=sender.request_header)

    view = AuthenticatedView.as_view()
    return view(request)


def test_get_hawk_authorized(client_credentials):
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret))
    assert response.status_code == status.HTTP_200_OK
    assert response.data == {'foo': 'bar'}


def test_get_hawk_unauthorized(client_credentials):
    client_credentials.authorized = False
    client_credentials.save()
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret))
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {'detail': ('No authorised credentials '
                                        'found with id %s') % client_credentials.client_id}


def test_get_no_auth():
    request = factory.get(url)
    view = AuthenticatedView.as_view()
    response = view(request)
    assert response.status_code == status.HTTP_200_OK
    assert response.data == {'foo': 'bar'}


def test_post_hawk_authorized(client_credentials):
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret), method='POST',
                                  content="{'this': 'that'}")
    assert response.status_code == status.HTTP_200_OK
    assert response.data == {'foo': 'bar'}


def test_post_hawk_unauthorized(client_credentials):
    client_credentials.authorized = False
    client_credentials.save()
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret), method='POST',
                                  content="{'this': 'that'}")
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {'detail': ('No authorised credentials '
                                        'found with id %s') % client_credentials.client_id}


def test_post_no_auth():
    request = factory.post(url)
    view = AuthenticatedView.as_view()
    response = view(request)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {'detail': 'Authentication credentials were not provided.'}


# Auth Login and Logout Tests

def test_auth_login_and_logout(test_ldap_user, client, monkeypatch):
    """LDAP login user exists, has scope: find by email"""
    def userinfo_mock(selfless, request):
        return {'sub': 'Mozilla-LDAP', 'email': test_ldap_user.email, 'exp': '500'}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    assert "sessionid" not in client.cookies

    client_id = "mozilla-ldap/user@foo.com"

    one_hour = 1000 * 60 * 60
    expires_at = int(round(time.time() * 1000)) + one_hour

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_IDTOKEN="meh",
        HTTP_EXPIRESAT=str(expires_at)
    )
    assert resp.status_code == 200

    session = client.session
    assert not session.is_empty()

    user = User.objects.get(id=session['_auth_user_id'])
    assert user.id == test_ldap_user.id
    assert user.username == client_id

    resp = client.get(reverse("auth-logout"))
    assert resp.status_code == 200
    assert client.session.is_empty()


@pytest.mark.django_db
def test_login_email_user_doesnt_exist(test_user, client, monkeypatch):
    """email login, user doesn't exist, create it"""
    def userinfo_mock(selfless, request):
        return {'sub': 'email', 'email': test_user.email, 'exp': '500'}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    one_hour = 1000 * 60 * 60
    expires_at = int(round(time.time() * 1000)) + one_hour

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_IDTOKEN="meh",
        HTTP_EXPIRESAT=str(expires_at)
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "email/user@foo.com"


@pytest.mark.django_db
def test_login_no_email(test_user, client, monkeypatch):
    """
    When we move to clientId for display in the UI, we may decide users can
    login without an email.  But for now, it's required.

    Note: Need to have the ``test_user`` fixture in this test, even though we
    don't use it directly.  If you don't, you will get a
    TransactionManagementError.

    I am MOSTLY certain this error happens because the model backend tries
    to authenticate the user, but there are NO users at all, so it hits an
    exception, which causes the TaskclusterAuthBackend to also fail because the
    transaction has been compromised.

    """
    def userinfo_mock(selfless, request):
        return {'sub': 'bad', 'email': test_user.email, 'exp': '500'}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    one_hour = 1000 * 60 * 60
    expires_at = int(round(time.time() * 1000)) + one_hour

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_IDTOKEN="meh",
        HTTP_EXPIRESAT=str(expires_at)
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Unrecognized identity"


@pytest.mark.django_db
def test_login_not_active(test_ldap_user, client, monkeypatch):
    """LDAP login, user not active"""
    def userinfo_mock(selfless, request):
        return {'sub': 'Mozilla-LDAP', 'email': test_ldap_user.email, 'exp': '500'}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    one_hour = 1000 * 60 * 60
    expires_at = int(round(time.time() * 1000)) + one_hour

    test_ldap_user.is_active = False
    test_ldap_user.save()

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_IDTOKEN="meh",
        HTTP_EXPIRESAT=str(expires_at)
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This user has been disabled."


def test_login_invalid(client):
    resp = client.get(reverse("auth-login"))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Authorization header is expected"
