import oauth2 as oauth
from django.core.urlresolvers import resolve, reverse
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.webapp.api.auth import TwoLeggedOauthAuthentication


class AuthenticatedView(APIView):
    authentication_classes = [TwoLeggedOauthAuthentication]

    def get(self, request, *args, **kwargs):
        return Response({'authenticated': hasattr(request, 'legacy_oauth_authenticated')})


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
