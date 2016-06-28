from mohawk import Sender
from rest_framework.decorators import APIView
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory

from treeherder.webapp.api import permissions


class AuthenticatedView(APIView):
    permission_classes = (permissions.HasHawkPermissions,)

    def get(self, request, *args, **kwargs):
        return Response({'authenticated': True})

    def post(self, request, *args, **kwargs):
        return Response({'authenticated': True})

factory = APIRequestFactory()


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
    assert response.data == {'detail': 'Service is down for maintenance.'}


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
    assert response.data == {'detail': 'Service is down for maintenance.'}


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

    assert response.data == {'detail': 'Service is down for maintenance.'}
