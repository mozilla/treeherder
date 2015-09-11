import oauth2 as oauth
from django.contrib.auth.models import User
from django.core.urlresolvers import resolve, reverse
from mohawk import Sender
import pytest
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from treeherder.application.models import Application
from treeherder.etl.oauth_utils import OAuthCredentials
from treeherder.webapp.api import permissions


class AuthenticatedView(APIView):
    permission_classes = (permissions.HasHawkOrLegacyOauthPermissions,)

    def get(self, request, *args, **kwargs):
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


@pytest.fixture
def api_user(request):
    user = User.objects.create_user('MyUser')

    def fin():
        user.delete()
    request.addfinalizer(fin)

    return user


def test_hawk_authorized(api_user):

    application = Application.objects.create(app_id='authorized-app', owner=api_user, authorized=True)
    auth = {
        'id': application.app_id,
        'key': str(application.secret),
        'algorithm': 'sha256'
    }
    url = u'http://testserver/'
    content_type = ''
    content = ''
    method = 'GET'

    sender = Sender(auth, url, method,
                    content=content, content_type=content_type)

    request = factory.get(url,
                          HTTP_AUTHORIZATION=sender.request_header,
                          content_type=content_type,
                          CONTENT_TYPE=content_type,
                          data=content)

    view = AuthenticatedView.as_view()

    response = view(request)
    assert response.data == {'authenticated': True}


def test_hawk_unauthorized(api_user):

    application = Application.objects.create(app_id='unauthorized-app', owner=api_user)
    auth = {
        'id': application.app_id,
        'key': str(application.secret),
        'algorithm': 'sha256'
    }
    url = u'http://testserver/'
    content_type = ''
    content = ''
    method = 'GET'

    sender = Sender(auth, url, method,
                    content=content, content_type=content_type)

    request = factory.get(url,
                          HTTP_AUTHORIZATION=sender.request_header,
                          content_type=content_type,
                          CONTENT_TYPE=content_type,
                          data=content)

    view = AuthenticatedView.as_view()
    response = view(request)

    assert response.data == {'detail': 'No application found with id unauthorized-app'}


def test_no_auth():
    url = u'http://testserver/'
    request = factory.get(url)
    view = AuthenticatedView.as_view()
    response = view(request)

    assert response.data == {'detail': 'Authentication credentials were not provided.'}
