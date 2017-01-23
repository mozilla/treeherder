from django.conf import settings
from rest_framework.decorators import APIView
from rest_framework.exceptions import NotAcceptable
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory


class RequestVersionView(APIView):
    def get(self, request, *args, **kwargs):
        return Response({'version': request.version})


factory = APIRequestFactory()


def test_unsupported_version():
        view = RequestVersionView.as_view()
        request = factory.get('/endpoint/', HTTP_ACCEPT='application/json; version=foo.bar')
        try:
            response = view(request)
        except NotAcceptable:
            pass
        assert response.data == {u'detail': u'Invalid version in "Accept" header.'}


def test_correct_version():
        view = RequestVersionView.as_view()
        version = settings.REST_FRAMEWORK['ALLOWED_VERSIONS'][0]
        request = factory.get('/endpoint/',
                              HTTP_ACCEPT='application/json; version={0}'.format(version))
        response = view(request)
        assert response.data == {'version': version}


def test_default_version():
        view = RequestVersionView.as_view()
        request = factory.get('/endpoint/', HTTP_ACCEPT='application/json')
        response = view(request)
        version = settings.REST_FRAMEWORK['DEFAULT_VERSION']
        assert response.data == {'version': version}
