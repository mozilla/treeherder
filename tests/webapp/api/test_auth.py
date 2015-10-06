import oauth2 as oauth
from django.core.urlresolvers import (resolve,
                                      reverse)
from mohawk import Sender
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.webapp.api import permissions


class AuthenticatedView(APIView):
    permission_classes = (permissions.HasHawkOrLegacyOauthPermissions,)

    def get(self, request, *args, **kwargs):
        return Response({'authenticated': True})

    def post(self, request, *args, **kwargs):
        return Response({'authenticated': True})

factory = APIRequestFactory()


def test_two_legged_oauth_authentication_not_detected():
    view = AuthenticatedView.as_view()
    request = factory.get('/')
    view(request)
    assert not hasattr(request, 'legacy_oauth_authenticated')


def test_two_legged_oauth_wrong_project():
    view = AuthenticatedView.as_view()
    test_url = '/api/'
    request = factory.get(test_url, {
        'oauth_body_hash': '',
        'oauth_consumer_key': '',
        'oauth_nonce': '',
        'oauth_signature_method': '',
        'oauth_timestamp': '',
        'oauth_token': '',
        'oauth_version': '',
        'oauth_signature': '',
        'user': 'foo'
    })
    request.resolver_match = resolve(test_url)
    response = view(request)

    assert response.status_code == 400


def test_two_legged_oauth_project_via_uri(monkeypatch, jm, set_oauth_credentials):
    view = AuthenticatedView.as_view()
    credentials = OAuthCredentials.get_credentials(jm.project)

    test_url = reverse('jobs-list', kwargs={'project': jm.project})
    request = factory.get(test_url, {
        'oauth_body_hash': '',
        'oauth_consumer_key': credentials['consumer_key'],
        'oauth_nonce': '',
        'oauth_signature_method': '',
        'oauth_timestamp': '',
        'oauth_token': '',
        'oauth_version': '',
        'oauth_signature': '',
        'user': 'foo'
    })
    request.resolver_match = resolve(test_url)
    monkeypatch.setattr(oauth.Server, 'verify_request', lambda *x, **y: True)
    response = view(request)

    assert response.data == {'authenticated': True}


def test_two_legged_oauth_project_via_user(monkeypatch, jm, set_oauth_credentials):
    view = AuthenticatedView.as_view()
    credentials = OAuthCredentials.get_credentials(jm.project)

    test_url = '/api/'
    request = factory.get(test_url, {
        'oauth_body_hash': '',
        'oauth_consumer_key': credentials['consumer_key'],
        'oauth_nonce': '',
        'oauth_signature_method': '',
        'oauth_timestamp': '',
        'oauth_token': '',
        'oauth_version': '',
        'oauth_signature': '',
        'user': jm.project
    })
    monkeypatch.setattr(oauth.Server, 'verify_request', lambda *x, **y: True)
    request.resolver_match = resolve(test_url)
    response = view(request)

    assert response.data == {'authenticated': True}


def _get_hawk_response(client_id, secret, method='GET',
                       content='', content_type='application/json'):
    auth = {
        'id': client_id,
        'key': secret,
        'algorithm': 'sha256'
    }
    url = 'http://testserver/'

    sender = Sender(auth, url, method,
                    content=content,
                    content_type='application/json')

    do_request = getattr(factory, method.lower())

    request = do_request(url,
                         data=content,
                         content_type='application/json',
                         # factory.get doesn't set the CONTENT_TYPE header
                         # I'm setting it manually here for simplicity
                         CONTENT_TYPE='application/json',
                         HTTP_AUTHORIZATION=sender.request_header)

    view = AuthenticatedView.as_view()

    return view(request)


def test_get_hawk_authorized(client_credentials):
    client_credentials.authorized = True
    client_credentials.save()
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret))
    assert response.data == {'authenticated': True}


def test_get_hawk_unauthorized(client_credentials):
    client_credentials.authorized = False
    client_credentials.save()
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret))
    assert response.data == {'detail': ('No authentication credentials '
                                        'found with id %s') % client_credentials.client_id}


def test_post_hawk_authorized(client_credentials):
    client_credentials.authorized = True
    client_credentials.save()
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret), method='POST',
                                  content="{'this': 'that'}")
    assert response.data == {'authenticated': True}


def test_post_hawk_unauthorized(client_credentials):
    client_credentials.authorized = False
    client_credentials.save()
    response = _get_hawk_response(client_credentials.client_id,
                                  str(client_credentials.secret), method='POST',
                                  content="{'this': 'that'}")
    assert response.data == {'detail': ('No authentication credentials '
                                        'found with id %s') % client_credentials.client_id}


def test_no_auth():
    url = u'http://testserver/'
    request = factory.get(url)
    view = AuthenticatedView.as_view()
    response = view(request)

    assert response.data == {'detail': 'Authentication credentials were not provided.'}
