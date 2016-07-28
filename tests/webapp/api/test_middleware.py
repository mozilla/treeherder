import json

from django.core.urlresolvers import reverse
from rest_framework.status import (HTTP_200_OK,
                                   HTTP_503_SERVICE_UNAVAILABLE)
from rest_framework.test import APITestCase

from treeherder.config.middleware import ReadOnlyMaintenanceMiddleware


class ReadOnlyMaintenanceMiddlewareTests(APITestCase):

    def _assert_request_was_blocked(self, response):
        assert response.status_code == HTTP_503_SERVICE_UNAVAILABLE
        assert json.loads(response.content) == {'detail': ReadOnlyMaintenanceMiddleware.message}

    def test_whitenoise_get_allowed(self):
        response = self.client.get('/')
        assert response.status_code == HTTP_200_OK

    def test_api_get_allowed(self):
        response = self.client.get(reverse('classified-failure-list'))
        assert response.status_code == HTTP_200_OK

    def test_api_post_blocked(self):
        response = self.client.post(reverse('bugzilla-create-bug'))
        self._assert_request_was_blocked(response)

    def test_api_put_blocked(self):
        response = self.client.put(reverse('bugzilla-create-bug'))
        self._assert_request_was_blocked(response)

    def test_api_delete_blocked(self):
        response = self.client.delete(reverse('bugzilla-create-bug'))
        self._assert_request_was_blocked(response)

    def test_django_admin_post_blocked(self):
        response = self.client.post('/admin/')
        self._assert_request_was_blocked(response)

    def test_persona_login_post_blocked(self):
        response = self.client.post(reverse('browserid.login'))
        self._assert_request_was_blocked(response)
