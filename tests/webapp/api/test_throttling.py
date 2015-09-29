from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView
from hawkrest import HawkAuthentication
from treeherder.webapp.api import throttling


class OauthKey1SecRateThrottle(throttling.OauthKeyThrottle):
    THROTTLE_RATES = {'foo': '1/sec'}


class HawkClient1SecRateThrottle(throttling.HawkClientThrottle):
    THROTTLE_RATES = {'foo': '1/sec'}


class MockView(APIView):
    throttle_classes = (OauthKey1SecRateThrottle, HawkClient1SecRateThrottle,)
    throttle_scope = 'foo'

    def get(self, request):
        return Response('foo')


class MockReceiver(object):
    parsed_header = {'id': 'my-client-id'}


def mock_authenticate(authentication_class, request):
    request.META['hawk.receiver'] = MockReceiver()


factory = APIRequestFactory()


def test_no_throttle():
    request = factory.get('/')

    response = MockView.as_view()(request)
    # first request ok
    response.status_code == 200

    for i in range(1):
        response = MockView.as_view()(request)
    # subsequent requests still ok
    response.status_code == 200


def test_oauth_key_throttle():
    request = factory.get('/', {'oauth_consumer_key': 'my-consumer-key'})

    response = MockView.as_view()(request)
    # first request ok
    response.status_code == 200

    for i in range(1):
        response = MockView.as_view()(request)
    # subsequent requests should get throttled
    assert response.status_code == 429


def test_hawk_client_throttle(monkeypatch):

    monkeypatch.setattr(HawkAuthentication, 'authenticate', mock_authenticate)

    request = factory.get('/')
    response = MockView.as_view()(request)

    # first request, everything ok
    response.status_code == 200

    for i in range(1):
        response = MockView.as_view()(request)
    # subsequent requests should get throttled
    assert response.status_code == 429
