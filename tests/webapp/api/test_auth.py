import time
from importlib import import_module

import pytest
from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from treeherder.auth.backends import AuthBackend
from treeherder.model.models import User

one_hour_in_seconds = 60 * 60
one_day_in_seconds = 24 * one_hour_in_seconds
SessionStore = import_module(settings.SESSION_ENGINE).SessionStore


class AuthenticatedView(APIView):
    """This inherits `IsAuthenticatedOrReadOnly` due to `DEFAULT_PERMISSION_CLASSES`."""

    def get(self, request, *args, **kwargs):
        return Response({'foo': 'bar'})

    def post(self, request, *args, **kwargs):
        return Response({'foo': 'bar'})


factory = APIRequestFactory()
url = 'http://testserver/'


def test_get_no_auth():
    request = factory.get(url)
    view = AuthenticatedView.as_view()
    response = view(request)
    assert response.status_code == status.HTTP_200_OK
    assert response.data == {'foo': 'bar'}


def test_post_no_auth():
    request = factory.post(url)
    view = AuthenticatedView.as_view()
    response = view(request)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data == {'detail': 'Authentication credentials were not provided.'}


# Auth Login and Logout Tests

def test_auth_login_and_logout(test_ldap_user, client, monkeypatch):
    """LDAP login user exists, has scope: find by email"""
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(selfless, request):
        return {'sub': 'Mozilla-LDAP', 'email': test_ldap_user.email, 'exp': id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    assert "sessionid" not in client.cookies

    client_id = "mozilla-ldap/user@foo.com"

    # Confusingly the `ExpiresAt` header is expected to be in milliseconds.
    # TODO: Change the frontend to pass seconds instead.
    expires_at = (now_in_seconds + one_hour_in_seconds) * 1000

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
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(selfless, request):
        return {'sub': 'email', 'email': test_user.email, 'exp': id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    # Confusingly the `ExpiresAt` header is expected to be in milliseconds.
    # TODO: Change the frontend to pass seconds instead.
    expires_at = (now_in_seconds + one_hour_in_seconds) * 1000

    resp = client.get(
        reverse("auth-login"),
        HTTP_AUTHORIZATION="Bearer meh",
        HTTP_IDTOKEN="meh",
        HTTP_EXPIRESAT=str(expires_at)
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "email/user@foo.com"


def test_login_unknown_identity_provider(client, monkeypatch):
    """Test an id token `sub` value that does not match a known identity provider."""
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(selfless, request):
        return {'sub': 'bad', 'email': 'foo@bar.com', 'exp': id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    # Confusingly the `ExpiresAt` header is expected to be in milliseconds.
    # TODO: Change the frontend to pass seconds instead.
    expires_at = (now_in_seconds + one_hour_in_seconds) * 1000

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
    now_in_seconds = int(time.time())
    id_token_expiration_timestamp = now_in_seconds + one_day_in_seconds

    def userinfo_mock(selfless, request):
        return {'sub': 'Mozilla-LDAP', 'email': test_ldap_user.email, 'exp': id_token_expiration_timestamp}

    monkeypatch.setattr(AuthBackend, '_get_user_info', userinfo_mock)

    # Confusingly the `ExpiresAt` header is expected to be in milliseconds.
    # TODO: Change the frontend to pass seconds instead.
    expires_at = (now_in_seconds + one_hour_in_seconds) * 1000

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
