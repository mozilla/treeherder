from django.http import JsonResponse
from rest_framework.permissions import SAFE_METHODS
from rest_framework.status import HTTP_503_SERVICE_UNAVAILABLE


class ReadOnlyMaintenanceMiddleware(object):
    """
    Return an HTTP503 for all requests apart from those that are read-only.
    """

    status_code = HTTP_503_SERVICE_UNAVAILABLE
    message = 'Site is in read-only mode for scheduled maintenance'

    def process_request(self, request):
        if request.method in SAFE_METHODS:
            return

        return JsonResponse(data={'detail': self.message}, status=self.status_code)
