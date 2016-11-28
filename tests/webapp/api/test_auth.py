from django.contrib.sessions.models import Session
from django.core.urlresolvers import reverse
from mohawk import Sender
from rest_framework import status
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from taskcluster.sync import Auth

from treeherder.model.models import User
from treeherder.webapp.api import permissions


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


# TC Auth Login and Logout Tests

def test_login_and_logout(test_user, webapp, monkeypatch):

    def mock_auth(selfless, payload):
        return {"status": "auth-success",
                "clientId": "foo",
                "scopes": ["assume:mozilla-user:user@foo.com"]
                }
    monkeypatch.setattr(Auth, 'authenticateHawk', mock_auth)

    assert "sessionid" not in webapp.cookies

    webapp.get(reverse("auth-login"), headers={"tcauth": "foo"}, status=200)
    session_key = webapp.cookies["sessionid"]
    session = Session.objects.get(session_key=session_key)
    session_data = session.get_decoded()
    user = User.objects.get(id=session_data.get('_auth_user_id'))
    assert user == test_user

    webapp.get(reverse("auth-logout"), status=200)
    assert "sessionid" not in webapp.cookies


def test_login_not_active(test_user, webapp, monkeypatch):
    def mock_auth(selfless, payload):
        return {"status": "auth-success",
                "clientId": "foo",
                "scopes": ["assume:mozilla-user:user@foo.com"]
                }
    monkeypatch.setattr(Auth, 'authenticateHawk', mock_auth)

    test_user.is_active = False
    test_user.save()

    resp = webapp.get(reverse("auth-login"), headers={"tcauth": "foo"}, status=403)
    assert resp.json["detail"] == "This user has been disabled."


def test_login_no_email(webapp, monkeypatch):
    def mock_auth(selfless, payload):
        return {"status": "auth-success",
                "clientId": "foo",
                "scopes": ["assume:mozilla-user:meh"]
                }
    monkeypatch.setattr(Auth, 'authenticateHawk', mock_auth)

    resp = webapp.get(reverse("auth-login"), headers={"tcauth": "foo"}, status=403)
    assert resp.json["detail"] == "Invalid email for clientId: 'foo'. Invalid value for scope 'assume:mozilla-user': 'meh'"


def test_login_invalid(webapp, monkeypatch):
    def mock_auth(selfless, payload):
        return {"status": "auth-failed",
                "message": "Don't try to frighten us with your sorcerous ways, Lord Vader."}
    monkeypatch.setattr(Auth, 'authenticateHawk', mock_auth)

    resp = webapp.get(reverse("auth-login"), headers={"tcauth": "foo"}, status=403)
    assert resp.json["detail"] == "Don't try to frighten us with your sorcerous ways, Lord Vader."
